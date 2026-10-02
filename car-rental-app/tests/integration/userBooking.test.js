const request = require('supertest');
const app = require('../../app'); // Path to your Express app
const User = require('../../models/User');
const Car = require('../../models/Car');
const Booking = require('../../models/Booking');
const mongoose = require('mongoose');

describe('User Booking API Endpoints (/api/bookings)', () => {
  let userAgent;
  let regularUser;
  let csrfToken;
  let testCar1, testCar2;

  beforeAll(async () => {
    // Create a regular user once for all tests in this suite
    regularUser = new User({ 
        username: 'bookinguser', 
        email: 'booker@example.com', 
        password: 'password123', 
        role: 'user' 
    });
    await regularUser.save();
  });
  
  beforeEach(async () => {
    userAgent = request.agent(app); // New agent for each test
    // Login as regular user
    const loginRes = await userAgent
      .post('/api/auth/login')
      .send({ email: 'booker@example.com', password: 'password123' });
    expect(loginRes.statusCode).toBe(200);

    // Fetch CSRF token after login
    const csrfRes = await userAgent.get('/api/csrf-token');
    expect(csrfRes.statusCode).toBe(200);
    csrfToken = csrfRes.body.csrfToken;
    expect(csrfToken).toBeDefined();

    // Clear and create sample cars for booking tests
    await Car.deleteMany({});
    testCar1 = await Car.create({ make: 'Honda', model: 'Accord', year: 2022, pricePerDay: 60, status: 'available' });
    testCar2 = await Car.create({ make: 'Toyota', model: 'Prius', year: 2021, pricePerDay: 50, status: 'maintenance' }); // Not available
    
    // Clear bookings
    await Booking.deleteMany({});
  });

  const futureStart = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
  const futureEnd = new Date(Date.now() + 86400000 * 8).toISOString().split('T')[0];
  const futureStartOver = new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0];
  const futureEndOver = new Date(Date.now() + 86400000 * 9).toISOString().split('T')[0];

  // --- POST /api/bookings (Create Booking) ---
  describe('POST /api/bookings', () => {
    it('should create a booking successfully for an available car', async () => {
      const bookingData = { 
        carId: testCar1._id.toString(), 
        startDate: futureStart, 
        endDate: futureEnd 
      };
      const res = await userAgent
        .post('/api/bookings')
        .set('CSRF-Token', csrfToken)
        .send(bookingData)
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.booking).toBeDefined();
      expect(res.body.data.booking.car._id.toString()).toBe(testCar1._id.toString()); // Assuming car is populated with _id
      expect(res.body.data.booking.user._id.toString()).toBe(regularUser._id.toString()); // Controller populates user
      expect(res.body.data.booking.status).toBe('pending');
      
      const dbBooking = await Booking.findById(res.body.data.booking._id);
      expect(dbBooking).not.toBeNull();
    });

    it('should return 400 if car is not available (e.g., maintenance)', async () => {
      const bookingData = { carId: testCar2._id.toString(), startDate: futureStart, endDate: futureEnd };
      const res = await userAgent
        .post('/api/bookings')
        .set('CSRF-Token', csrfToken)
        .send(bookingData)
        .expect(400); // Controller should check car.status
      expect(res.body.message).toContain('Car is not currently available for booking');
    });

    it('should return 409 if car is already booked for overlapping dates', async () => {
      // First booking
      await Booking.create({
        user: regularUser._id,
        car: testCar1._id,
        startDate: new Date(futureStart),
        endDate: new Date(futureEnd),
        totalPrice: 120,
        status: 'confirmed'
      });
      
      const bookingData = { carId: testCar1._id.toString(), startDate: futureStartOver, endDate: futureEndOver }; // Overlapping
      const res = await userAgent
        .post('/api/bookings')
        .set('CSRF-Token', csrfToken)
        .send(bookingData)
        .expect(409);
      expect(res.body.message).toContain('Car is already booked for the selected dates');
    });
    
    it('should return 422 for validation errors (e.g., end date before start date)', async () => {
      const bookingData = { carId: testCar1._id.toString(), startDate: futureEnd, endDate: futureStart };
      const res = await userAgent
        .post('/api/bookings')
        .set('CSRF-Token', csrfToken)
        .send(bookingData)
        .expect(422);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Validation failed');
      // Check for specific error message (depends on express-validator setup in routes)
      // For custom validator:
      expect(res.body.errors.some(err => err.msg.includes('End date must be after start date'))).toBe(true);
    });
  });

  // --- GET /api/bookings/my-bookings ---
  describe('GET /api/bookings/my-bookings', () => {
    it('should return an empty list if user has no bookings', async () => {
      const res = await userAgent.get('/api/bookings/my-bookings').expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.bookings.length).toBe(0);
    });

    it('should return a list of the user\'s bookings', async () => {
      await Booking.create({ user: regularUser._id, car: testCar1._id, startDate: futureStart, endDate: futureEnd, totalPrice: 180 });
      const otherUser = await User.create({username: 'otherbooker', email:'other@mail.com', password: 'password123'});
      await Booking.create({ user: otherUser._id, car: testCar1._id, startDate: futureStartOver, endDate: futureEndOver, totalPrice: 180 });
      
      const res = await userAgent.get('/api/bookings/my-bookings').expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.bookings.length).toBe(1);
      const bookingUserId = res.body.data.bookings[0].user._id || res.body.data.bookings[0].user;
      expect(bookingUserId.toString()).toBe(regularUser._id.toString());
    });
  });

  // --- POST /api/bookings/:id/cancel ---
  describe('POST /api/bookings/:id/cancel', () => {
    let userBooking;
    beforeEach(async () => {
        userBooking = await Booking.create({ 
            user: regularUser._id, 
            car: testCar1._id, 
            startDate: new Date(futureStart), 
            endDate: new Date(futureEnd), 
            totalPrice: 120, 
            status: 'pending' 
        });
    });

    it('should allow a user to cancel their own pending booking', async () => {
      const res = await userAgent
        .post(`/api/bookings/${userBooking._id}/cancel`)
        .set('CSRF-Token', csrfToken)
        .expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.newStatus).toBe('cancelled');
      const dbBooking = await Booking.findById(userBooking._id);
      expect(dbBooking.status).toBe('cancelled');
    });

    it('should return 403 if user tries to cancel another user\'s booking', async () => {
      const otherUser = await User.create({username: 'another', email:'another@mail.com', password: 'password123'});
      const otherBooking = await Booking.create({ user: otherUser._id, car: testCar1._id, startDate: futureStartOver, endDate: futureEndOver, totalPrice: 180, status: 'pending' });
      
      await userAgent
        .post(`/api/bookings/${otherBooking._id}/cancel`)
        .set('CSRF-Token', csrfToken)
        .expect(403);
    });
    
    it('should return 400 if booking is not in a cancellable state (e.g. completed)', async () => {
        userBooking.status = 'completed';
        await userBooking.save();
        await userAgent
            .post(`/api/bookings/${userBooking._id}/cancel`)
            .set('CSRF-Token', csrfToken)
            .expect(400);
    });
    
    it('should return 404 if booking to cancel is not found', async () => {
        const unknownId = new mongoose.Types.ObjectId();
        await userAgent.post(`/api/bookings/${unknownId}/cancel`)
            .set('CSRF-Token', csrfToken)
            .expect(404);
    });
  });
  
  // Test unauthorized access (user not logged in)
  describe('Authorization for User Booking Routes', () => {
    it('should return 401 for GET /api/bookings/my-bookings if not logged in', async () => {
        const freshAgent = request.agent(app); // No session
        await freshAgent.get('/api/bookings/my-bookings').expect(401);
    });
    
    it('should return 401 for POST /api/bookings if not logged in', async () => {
        const freshAgent = request.agent(app);
        // For POST, even if ensureAuthenticated blocks first, CSRF middleware might also run.
        // A truly unauthenticated agent might not have a CSRF token readily.
        // However, ensureAuthenticated should reject before CSRF check for this case.
        await freshAgent.post('/api/bookings')
            // .set('CSRF-Token', 'someGuestTokenIfAvailable') // Not strictly needed if auth fails first
            .send({ carId: testCar1._id.toString(), startDate: futureStart, endDate: futureEnd })
            .expect(401); // ensureAuthenticated should block
    });
  });
});
