const request = require('supertest');
const app = require('../../app'); // Path to your Express app
const User = require('../../models/User');
const Car = require('../../models/Car');
const Booking = require('../../models/Booking');
const mongoose = require('mongoose');

describe('Admin Booking API Endpoints (/api/admin/bookings)', () => {
  let adminAgent, regularUserAgent;
  let adminUser, regularUser, testCar;
  let csrfTokenAdmin, csrfTokenUser; // Separate CSRF for admin and user if needed for different scenarios

  beforeAll(async () => {
    // Create users
    adminUser = await User.create({ username: 'bookingadmin', email: 'bookingadmin@example.com', password: 'password123', role: 'admin' });
    regularUser = await User.create({ username: 'bookingregular', email: 'bookingregular@example.com', password: 'password123', role: 'user' });
  });

  beforeEach(async () => {
    // Admin Agent
    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send({ email: 'bookingadmin@example.com', password: 'password123' }).expect(200);
    const adminCsrfRes = await adminAgent.get('/api/csrf-token');
    csrfTokenAdmin = adminCsrfRes.body.csrfToken;

    // Regular User Agent (for creating bookings to be managed by admin)
    regularUserAgent = request.agent(app);
    await regularUserAgent.post('/api/auth/login').send({ email: 'bookingregular@example.com', password: 'password123' }).expect(200);
    const userCsrfRes = await regularUserAgent.get('/api/csrf-token');
    csrfTokenUser = userCsrfRes.body.csrfToken;
    
    // Clear and create sample car
    await Car.deleteMany({});
    testCar = await Car.create({ make: 'AdminTestCar', model: 'ForBooking', year: 2023, pricePerDay: 100, status: 'available' });
    
    // Clear bookings
    await Booking.deleteMany({});
  });

  // --- GET /api/admin/bookings (List All Bookings) ---
  describe('GET /api/admin/bookings', () => {
    it('should return a list of all bookings (empty if none)', async () => {
      const res = await adminAgent.get('/api/admin/bookings').set('CSRF-Token', csrfTokenAdmin).expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.bookings.length).toBe(0);
    });

    it('should return all bookings with user and car details populated', async () => {
      // Create a booking as regularUser
      await Booking.create({ user: regularUser._id, car: testCar._id, startDate: '2024-08-01', endDate: '2024-08-03', totalPrice: 200, status: 'pending' });
      
      const res = await adminAgent.get('/api/admin/bookings').set('CSRF-Token', csrfTokenAdmin).expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.bookings.length).toBe(1);
      expect(res.body.data.bookings[0].user.username).toBe('bookingregular');
      expect(res.body.data.bookings[0].car.make).toBe('AdminTestCar');
    });
    
    it('should filter bookings by status', async () => {
        await Booking.create({ user: regularUser._id, car: testCar._id, startDate: '2024-08-01', endDate: '2024-08-03', totalPrice: 200, status: 'pending' });
        await Booking.create({ user: regularUser._id, car: testCar._id, startDate: '2024-08-05', endDate: '2024-08-07', totalPrice: 200, status: 'confirmed' });
        
        const res = await adminAgent.get('/api/admin/bookings?status=confirmed').set('CSRF-Token', csrfTokenAdmin).expect(200);
        expect(res.body.data.bookings.length).toBe(1);
        expect(res.body.data.bookings[0].status).toBe('confirmed');
    });
    
    it('should be protected: non-admin user cannot access', async () => {
        await regularUserAgent.get('/api/admin/bookings').set('CSRF-Token', csrfTokenUser).expect(403);
    });
  });

  // --- PUT /api/admin/bookings/:id/status (Update Booking Status) ---
  describe('PUT /api/admin/bookings/:id/status', () => {
    let bookingToUpdate;
    beforeEach(async () => {
        bookingToUpdate = await Booking.create({ 
            user: regularUser._id, 
            car: testCar._id, 
            startDate: '2024-09-01', 
            endDate: '2024-09-03', 
            totalPrice: 200, 
            status: 'pending' 
        });
    });

    it('should allow admin to update booking status (e.g., to confirmed)', async () => {
      const res = await adminAgent
        .put(`/api/admin/bookings/${bookingToUpdate._id}/status`)
        .set('CSRF-Token', csrfTokenAdmin)
        .send({ status: 'confirmed' })
        .expect(200);
      
      expect(res.body.status).toBe('success');
      expect(res.body.data.booking.status).toBe('confirmed');
      const dbBooking = await Booking.findById(bookingToUpdate._id);
      expect(dbBooking.status).toBe('confirmed');
    });

    it('should return 422 for invalid status value', async () => {
      await adminAgent
        .put(`/api/admin/bookings/${bookingToUpdate._id}/status`)
        .set('CSRF-Token', csrfTokenAdmin)
        .send({ status: 'invalidStatusValue' })
        .expect(422); // express-validator check
    });
    
    it('should return 400 for illogical status transition (e.g. completed to pending)', async () => {
        bookingToUpdate.status = 'completed';
        await bookingToUpdate.save();
        
        await adminAgent
            .put(`/api/admin/bookings/${bookingToUpdate._id}/status`)
            .set('CSRF-Token', csrfTokenAdmin)
            .send({ status: 'pending' })
            .expect(400);
    });

    it('should return 404 if booking to update is not found', async () => {
        const unknownId = new mongoose.Types.ObjectId();
        await adminAgent
            .put(`/api/admin/bookings/${unknownId}/status`)
            .set('CSRF-Token', csrfTokenAdmin)
            .send({ status: 'confirmed' })
            .expect(404);
    });
    
    it('should be protected: non-admin user cannot update status', async () => {
        await regularUserAgent
            .put(`/api/admin/bookings/${bookingToUpdate._id}/status`)
            .set('CSRF-Token', csrfTokenUser)
            .send({ status: 'confirmed' })
            .expect(403);
    });
  });
});
