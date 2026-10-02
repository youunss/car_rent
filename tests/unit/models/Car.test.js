const mongoose = require('mongoose');
const Car = require('../../../models/Car'); // Adjust path

describe('Car Model', () => {
  beforeEach(async () => {
    await Car.deleteMany({});
  });

  it('should create a car successfully with valid data', async () => {
    const carData = { make: 'Toyota', model: 'Camry', year: 2022, pricePerDay: 50 };
    const car = new Car(carData);
    const savedCar = await car.save();
    expect(savedCar._id).toBeDefined();
    expect(savedCar.make).toBe(carData.make);
    expect(savedCar.status).toBe('available'); // Default status
    expect(savedCar.features).toEqual([]); // Default features
  });

  it('should require make, model, year, and pricePerDay', async () => {
    const requiredFields = ['make', 'model', 'year', 'pricePerDay'];
    for (const field of requiredFields) {
        const carData = { make: 'Test', model: 'TestCar', year: 2021, pricePerDay: 60 };
        delete carData[field]; // Remove one required field
        const car = new Car(carData);
        let err;
        try { await car.save(); } catch (error) { err = error; }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors[field]).toBeDefined();
    }
  });

  it('should validate year (min 1900, max current year + 1)', async () => {
    let car = new Car({ make: 'Test', model: 'Oldie', year: 1899, pricePerDay: 10 });
    let err;
    try { await car.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.year).toBeDefined();

    car = new Car({ make: 'Test', model: 'Future', year: new Date().getFullYear() + 2, pricePerDay: 100 });
    try { await car.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.year).toBeDefined();
  });

  it('should validate pricePerDay (must be positive or zero)', async () => {
    let car = new Car({ make: 'Test', model: 'NegativePrice', year: 2020, pricePerDay: -10 });
    let err;
    try { await car.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.pricePerDay).toBeDefined();
  });

  it('should validate status enum', async () => {
    let car = new Car({ make: 'Test', model: 'InvalidStatus', year: 2020, pricePerDay: 50, status: 'broken' });
    let err;
    try { await car.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.status).toBeDefined();
  });
});
