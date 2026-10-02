const request = require('supertest');
const app = require('../../app'); // Path to your Express app
const User = require('../../models/User');
const Car = require('../../models/Car');
const mongoose = require('mongoose');
const path = require('path'); // For file uploads
const fs = require('fs'); // To ensure fixture directory exists

// Ensure fixture directory exists
const fixturesDir = path.resolve(__dirname, '../fixtures');
if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
}
// Create a dummy image file if it doesn't exist (simple placeholder)
const dummyImagePath = path.resolve(fixturesDir, 'test-image.png');
if (!fs.existsSync(dummyImagePath)) {
    // Create a tiny valid PNG (1x1 transparent pixel)
    const PngMinimal = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
    );
    fs.writeFileSync(dummyImagePath, PngMinimal);
}


describe('Admin Car API Endpoints', () => {
  let adminAgent; // Agent for admin user (logged in)
  let adminUser;
  let csrfToken;

  beforeAll(async () => {
    // Create an admin user once for all tests in this suite
    adminUser = new User({ 
        username: 'admincaruploader', 
        email: 'admincar@example.com', 
        password: 'password123', 
        role: 'admin' 
    });
    await adminUser.save();
  });
  
  beforeEach(async () => {
    adminAgent = request.agent(app); // New agent for each test to ensure cookie isolation
    // Login as admin
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ email: 'admincar@example.com', password: 'password123' });
    expect(loginRes.statusCode).toBe(200); // Ensure login is successful

    // Fetch CSRF token after login for this agent
    const csrfRes = await adminAgent.get('/api/csrf-token');
    expect(csrfRes.statusCode).toBe(200);
    csrfToken = csrfRes.body.csrfToken;
    expect(csrfToken).toBeDefined();
  });

  // --- POST /api/admin/cars (Add Car) ---
  describe('POST /api/admin/cars', () => {
    it('should add a new car successfully without an image', async () => {
      const carData = { make: 'Honda', model: 'Civic', year: 2023, pricePerDay: 60, status: 'available' };
      const res = await adminAgent
        .post('/api/admin/cars')
        .set('CSRF-Token', csrfToken)
        .send(carData)
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.car).toBeDefined();
      expect(res.body.data.car.make).toBe('Honda');
      const dbCar = await Car.findById(res.body.data.car._id);
      expect(dbCar).not.toBeNull();
    });

    it('should add a new car successfully with an image', async () => {
      const res = await adminAgent
        .post('/api/admin/cars')
        .set('CSRF-Token', csrfToken)
        .field('make', 'Toyota')
        .field('model', 'Corolla')
        .field('year', 2023)
        .field('pricePerDay', 55)
        .field('status', 'available')
        .attach('carImage', dummyImagePath) 
        .expect(201);
      
      expect(res.body.status).toBe('success');
      expect(res.body.data.car.make).toBe('Toyota');
      expect(res.body.data.car.imageURL).toBeDefined();
      // Multer typically names files with fieldname-timestamp or similar
      // Check if the imageURL contains 'carImage' which is the field name.
      expect(res.body.data.car.imageURL).toMatch(/carImage/); 
    });

    it('should return 422 for validation errors (e.g., missing make)', async () => {
      const res = await adminAgent
        .post('/api/admin/cars')
        .set('CSRF-Token', csrfToken)
        .send({ model: 'Civic', year: 2023, pricePerDay: 60 }) // Missing 'make'
        .expect(422);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Validation failed');
      // Check if the errors array contains an error for the 'make' parameter
      expect(res.body.errors.some(err => err.param === 'make' || (err.path && err.path === 'make'))).toBe(true);
    });
  });

  // --- GET /api/admin/cars (List Cars) ---
  describe('GET /api/admin/cars', () => {
    it('should return a list of cars', async () => {
      await Car.deleteMany({});
      await Car.create({ make: 'TestCar1', model: 'ModelA', year: 2020, pricePerDay: 50 });
      await Car.create({ make: 'TestCar2', model: 'ModelB', year: 2021, pricePerDay: 70 });

      const res = await adminAgent.get('/api/admin/cars').expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.cars).toBeInstanceOf(Array);
      expect(res.body.data.cars.length).toBe(2);
    });
  });

  // --- GET /api/admin/cars/:id (Get Car Details) ---
  describe('GET /api/admin/cars/:id', () => {
    it('should return details of a specific car', async () => {
      const car = await Car.create({ make: 'DetailCar', model: 'ModelC', year: 2022, pricePerDay: 80 });
      const res = await adminAgent.get(`/api/admin/cars/${car._id}`).expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.car.make).toBe('DetailCar');
    });
    it('should return 404 if car not found', async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();
      await adminAgent.get(`/api/admin/cars/${unknownId}`).expect(404);
    });
  });
  
  // --- PUT /api/admin/cars/:id (Edit Car) ---
  describe('PUT /api/admin/cars/:id', () => {
    it('should update an existing car successfully', async () => {
      const car = await Car.create({ make: 'OldMake', model: 'OldModel', year: 2020, pricePerDay: 50 });
      const updatedData = { make: 'NewMake', model: 'NewModel', year: 2021, pricePerDay: 55, status: 'maintenance' };
      
      const res = await adminAgent
        .put(`/api/admin/cars/${car._id}`)
        .set('CSRF-Token', csrfToken)
        .send(updatedData)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.car.make).toBe('NewMake');
      expect(res.body.data.car.status).toBe('maintenance');
      const dbCar = await Car.findById(car._id);
      expect(dbCar.make).toBe('NewMake');
    });
    
    it('should return 404 if car to update is not found', async () => {
        const unknownId = new mongoose.Types.ObjectId().toString();
        await adminAgent.put(`/api/admin/cars/${unknownId}`)
            .set('CSRF-Token', csrfToken)
            .send({ make: 'AnyMake', model:'AnyModel', year:2022, pricePerDay:50 }) 
            .expect(404);
    });
  });

  // --- DELETE /api/admin/cars/:id (Delete Car) ---
  describe('DELETE /api/admin/cars/:id', () => {
    it('should delete an existing car successfully', async () => {
      const car = await Car.create({ make: 'DeleteMe', model: 'ModelD', year: 2020, pricePerDay: 50 });
      
      const res = await adminAgent
        .delete(`/api/admin/cars/${car._id}`)
        .set('CSRF-Token', csrfToken)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('Car deleted successfully');
      const dbCar = await Car.findById(car._id);
      expect(dbCar).toBeNull();
    });
    
    it('should return 404 if car to delete is not found', async () => {
        const unknownId = new mongoose.Types.ObjectId().toString();
        await adminAgent.delete(`/api/admin/cars/${unknownId}`)
            .set('CSRF-Token', csrfToken)
            .expect(404);
    });
  });
  
  // Test unauthorized access (non-admin user)
  describe('Authorization for Admin Car Routes', () => {
    let userAgent;
    let userCsrfToken;

    beforeEach(async () => {
        // Create and login as a non-admin user
        await User.deleteOne({ email: 'regular@example.com' });
        await User.deleteOne({ username: 'regularuser' });
        const regularUser = new User({ username: 'regularuser', email: 'regular@example.com', password: 'password123', role: 'user' });
        await regularUser.save();
        
        userAgent = request.agent(app);
        await userAgent.post('/api/auth/login').send({ email: 'regular@example.com', password: 'password123' });
        const csrfRes = await userAgent.get('/api/csrf-token');
        userCsrfToken = csrfRes.body.csrfToken;
    });

    it('should return 403 Forbidden for GET /api/admin/cars if user is not admin', async () => {
        await userAgent.get('/api/admin/cars').expect(403); // isAdmin middleware should block
    });
    
    it('should return 403 Forbidden for POST /api/admin/cars if user is not admin', async () => {
        await userAgent.post('/api/admin/cars')
            .set('CSRF-Token', userCsrfToken)
            .send({ make: 'Attempt', model: 'Fail', year: 2023, pricePerDay: 100})
            .expect(403); // isAdmin middleware should block
    });
  });

});
