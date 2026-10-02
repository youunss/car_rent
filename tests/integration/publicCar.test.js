const request = require('supertest');
const app = require('../../app'); // Path to your Express app
const Car = require('../../models/Car');
const mongoose = require('mongoose');

describe('Public Car API Endpoints (/api/cars)', () => {
  // No specific agent needed for public GET requests, but can use one for consistency
  let agent;

  beforeEach(async () => {
    agent = request.agent(app); 
    // Clear Car collection before each test to ensure isolation
    await Car.deleteMany({});
  });

  // --- GET /api/cars (List Available Cars) ---
  describe('GET /api/cars', () => {
    it('should return an empty list if no cars are available', async () => {
      const res = await agent.get('/api/cars').expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.cars).toBeInstanceOf(Array);
      expect(res.body.data.cars.length).toBe(0);
      expect(res.body.data.pagination.totalCars).toBe(0);
    });

    it('should return a list of available cars', async () => {
      await Car.create([
        { make: 'Honda', model: 'Civic', year: 2022, pricePerDay: 50, status: 'available' },
        { make: 'Toyota', model: 'Corolla', year: 2021, pricePerDay: 45, status: 'available' },
        { make: 'BMW', model: 'X5', year: 2023, pricePerDay: 150, status: 'maintenance' }, // Not available
      ]);

      const res = await agent.get('/api/cars').expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.cars.length).toBe(2);
      expect(res.body.data.cars.every(car => car.status === 'available')).toBe(true);
    });

    it('should filter cars by search query (make or model)', async () => {
      await Car.create([
        { make: 'Honda', model: 'Civic', year: 2022, pricePerDay: 50, status: 'available' },
        { make: 'Toyota', model: 'Camry', year: 2021, pricePerDay: 60, status: 'available' },
        { make: 'Toyota', model: 'Rav4', year: 2023, pricePerDay: 70, status: 'available' },
      ]);
      const res = await agent.get('/api/cars?search=Toyota').expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.cars.length).toBe(2);
      expect(res.body.data.cars.every(car => car.make === 'Toyota')).toBe(true);
    });

    it('should filter cars by price range', async () => {
      await Car.create([
        { make: 'Kia', model: 'Rio', year: 2022, pricePerDay: 40, status: 'available' },
        { make: 'Honda', model: 'Civic', year: 2022, pricePerDay: 55, status: 'available' },
        { make: 'Toyota', model: 'Camry', year: 2021, pricePerDay: 65, status: 'available' },
      ]);
      const res = await agent.get('/api/cars?minPrice=50&maxPrice=60').expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.cars.length).toBe(1);
      expect(res.body.data.cars[0].model).toBe('Civic');
    });

    it('should handle pagination correctly', async () => {
      // Create 12 available cars
      for (let i = 0; i < 12; i++) {
        await Car.create({ make: 'TestMake', model: `Model${i}`, year: 2022, pricePerDay: 50 + i, status: 'available' });
      }
      // Default limit is 10
      let res = await agent.get('/api/cars?page=1').expect(200);
      expect(res.body.data.cars.length).toBe(10);
      expect(res.body.data.pagination.currentPage).toBe(1);
      expect(res.body.data.pagination.totalPages).toBe(2);
      expect(res.body.data.pagination.totalCars).toBe(12);

      res = await agent.get('/api/cars?page=2').expect(200);
      expect(res.body.data.cars.length).toBe(2);
      expect(res.body.data.pagination.currentPage).toBe(2);

      // Test with custom limit
      res = await agent.get('/api/cars?limit=4&page=3').expect(200);
      expect(res.body.data.cars.length).toBe(4); // This should be 0 if total 12, limit 4, page 3 (1-4, 5-8, 9-12)
                                                // If it means 4 cars on page 3, then it should be 0.
                                                // Corrected logic: Page 3 with limit 4 means cars 9, 10, 11, 12. So 4 cars.
      expect(res.body.data.pagination.currentPage).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(3);
    });
  });

  // --- GET /api/cars/:id (Get Car Details) ---
  describe('GET /api/cars/:id', () => {
    it('should return details of a specific car', async () => {
      const car = await Car.create({ make: 'DetailCar', model: 'PublicView', year: 2022, pricePerDay: 90, status: 'available' });
      const res = await agent.get(`/api/cars/${car._id}`).expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.car.make).toBe('DetailCar');
      expect(res.body.data.car._id.toString()).toBe(car._id.toString());
    });

    it('should return details of a car even if not "available" (e.g. "maintenance")', async () => {
      // The controller logic currently allows fetching details of non-available cars for public view
      // Booking logic would prevent booking it.
      const car = await Car.create({ make: 'MaintCar', model: 'UnderMaint', year: 2022, pricePerDay: 90, status: 'maintenance' });
      const res = await agent.get(`/api/cars/${car._id}`).expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.car.make).toBe('MaintCar');
    });

    it('should return 404 if car not found', async () => {
      const unknownId = new mongoose.Types.ObjectId();
      const res = await agent.get(`/api/cars/${unknownId}`).expect(404);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Car not found');
    });

    it('should return 400 for invalid car ID format', async () => {
      const res = await agent.get('/api/cars/invalidID123').expect(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Car not found (invalid ID format)');
    });
  });
});
