// tests/unit/controllers/admin/carController.test.js
const adminCarController = require('../../../../controllers/admin/carController'); // Adjust path
const Car = require('../../../../models/Car');
const { successResponse, errorResponse } = require('../../../../utils/apiResponse');
const { validationResult } = require('express-validator'); // To mock its return value
const fs = require('fs');
const path = require('path');

jest.mock('../../../../models/Car', () => {
  const mockCar = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
  });
  mockCar.find = jest.fn();
  mockCar.findById = jest.fn();
  mockCar.findByIdAndDelete = jest.fn();
  mockCar.countDocuments = jest.fn();
  mockCar.prototype.save = jest.fn().mockResolvedValue(this);
  return mockCar;
});
jest.mock('../../../../utils/apiResponse');
jest.mock('express-validator');
jest.mock('fs'); // Mock the fs module

describe('Admin Car Controller', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { body: {}, params: {}, file: null, query: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    
    // Clear mocks
    Car.find.mockClear();
    Car.findById.mockClear();
    Car.findByIdAndDelete.mockClear();
    // Ensure prototype.save is defined if Car is a class mock
    if (Car.prototype && Car.prototype.save) Car.prototype.save.mockClear(); else Car.prototype.save = jest.fn();
    
    successResponse.mockClear();
    errorResponse.mockClear();
    validationResult.mockClear();
    fs.existsSync.mockClear();
    fs.unlink.mockClear();
  });

  // --- listCars ---
  describe('listCars', () => {
    it('should fetch and return all cars', async () => {
      const mockCars = [{ make: 'AdminCar1' }];
      Car.find.mockResolvedValue(mockCars);
      await adminCarController.listCars(mockReq, mockRes, mockNext);
      expect(Car.find).toHaveBeenCalledWith();
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Cars fetched successfully.', { cars: mockCars });
    });
    it('should call next with error if Car.find fails', async () => {
      const dbError = new Error('DB Error');
      Car.find.mockRejectedValue(dbError);
      await adminCarController.listCars(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // --- getCarDetails ---
  describe('getCarDetails', () => {
    it('should fetch and return a single car by ID', async () => {
      mockReq.params.id = 'car1';
      const mockCar = { _id: 'car1', make: 'DetailCar' };
      Car.findById.mockResolvedValue(mockCar);
      await adminCarController.getCarDetails(mockReq, mockRes, mockNext);
      expect(Car.findById).toHaveBeenCalledWith('car1');
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Car details fetched.', { car: mockCar });
    });
    it('should return 404 if car not found', async () => {
      mockReq.params.id = 'notfound';
      Car.findById.mockResolvedValue(null);
      await adminCarController.getCarDetails(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car not found.', 404);
    });
  });

  // --- addCar ---
  describe('addCar', () => {
    beforeEach(() => {
      // Mock validationResult to return an empty array (no errors) by default
      validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    });

    it('should add a new car successfully without an image', async () => {
      mockReq.body = { make: 'NewMake', model: 'NewModel', year: 2023, pricePerDay: 100, status: 'available', features: 'AC,GPS' };
      const savedCarInstance = { ...mockReq.body, _id: 'newCarId', imageURL: null, features: ['AC', 'GPS']};
      Car.prototype.save.mockResolvedValue(savedCarInstance); // Mock the save method on the instance

      await adminCarController.addCar(mockReq, mockRes, mockNext);
      
      expect(Car.prototype.save).toHaveBeenCalled();
      // Check constructor arguments if Car is a class mock, or properties if it's a direct assignment
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Car added successfully.', { car: savedCarInstance }, 201);
    });

    it('should add a new car successfully with an image', async () => {
      mockReq.body = { make: 'ImageCar', model: 'ModelX', year: 2024, pricePerDay: 150 };
      mockReq.file = { filename: 'carimage.jpg' };
      const savedCarInstance = { ...mockReq.body, _id: 'imageCarId', imageURL: '/uploads/cars/carimage.jpg' };
      Car.prototype.save.mockResolvedValue(savedCarInstance);

      await adminCarController.addCar(mockReq, mockRes, mockNext);
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Car added successfully.', { car: savedCarInstance }, 201);
    });

    it('should return validation errors if present', async () => {
      const mockErrors = [{ msg: 'Make is required', param: 'make' }];
      validationResult.mockReturnValue({ isEmpty: () => false, array: () => mockErrors });
      
      await adminCarController.addCar(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Validation failed.', 422, mockErrors);
    });
    
    it('should handle duplicate key error (e.g. code 11000) on save', async () => {
        mockReq.body = { make: 'DuplicateCar', model: 'ModelD', year: 2023, pricePerDay: 100 };
        const dbError = new Error('Duplicate key');
        dbError.code = 11000;
        Car.prototype.save.mockRejectedValue(dbError);

        await adminCarController.addCar(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'A car with similar unique details already exists.', 409);
    });

    it('should call next with error for other save failures', async () => {
        mockReq.body = { make: 'FailCar', model: 'ModelF', year: 2023, pricePerDay: 100 };
        const dbError = new Error('Generic DB save error');
        Car.prototype.save.mockRejectedValue(dbError);

        await adminCarController.addCar(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // --- editCar --- (Illustrative - add more tests for image handling, errors)
  describe('editCar', () => {
    beforeEach(() => {
      validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    });

    it('should edit an existing car successfully', async () => {
      mockReq.params.id = 'editCarId';
      mockReq.body = { make: 'UpdatedMake', model: 'UpdatedModel', year: 2022, pricePerDay: 120 };
      
      const mockCarInstance = { 
        ...mockReq.body, 
        _id: 'editCarId', 
        imageURL: null, // Assuming no new image for this test case
        // Manually assign properties that would be set by Mongoose setter/getter or default
        status: 'available', 
        features: [],
        save: jest.fn().mockResolvedValue(null) // Mock save on the instance
      };
      Car.findById.mockResolvedValue(mockCarInstance);

      await adminCarController.editCar(mockReq, mockRes, mockNext);

      expect(Car.findById).toHaveBeenCalledWith('editCarId');
      expect(mockCarInstance.make).toBe('UpdatedMake'); // Check properties were updated
      expect(mockCarInstance.save).toHaveBeenCalled();
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Car updated successfully.', { car: mockCarInstance });
    });
    
    it('should return 404 if car to edit is not found', async () => {
        mockReq.params.id = 'nonExistentId';
        Car.findById.mockResolvedValue(null);
        await adminCarController.editCar(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car not found.', 404);
    });
  });

  // --- deleteCar --- (Illustrative - add more tests for image deletion, errors)
  describe('deleteCar', () => {
    it('should delete a car successfully (no image)', async () => {
      mockReq.params.id = 'deleteCarId';
      const mockCarInstance = { _id: 'deleteCarId', imageURL: null };
      Car.findById.mockResolvedValue(mockCarInstance);
      Car.findByIdAndDelete.mockResolvedValue(mockCarInstance); // Assume deletion returns the object

      await adminCarController.deleteCar(mockReq, mockRes, mockNext);

      expect(Car.findById).toHaveBeenCalledWith('deleteCarId');
      expect(Car.findByIdAndDelete).toHaveBeenCalledWith('deleteCarId');
      expect(fs.existsSync).not.toHaveBeenCalled(); // No image, so no fs checks
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Car deleted successfully.');
    });
    
    it('should delete a car and its image if imageURL exists', async () => {
        mockReq.params.id = 'deleteCarWithImageId';
        const mockCarInstance = { _id: 'deleteCarWithImageId', imageURL: '/uploads/cars/test.jpg' };
        Car.findById.mockResolvedValue(mockCarInstance);
        Car.findByIdAndDelete.mockResolvedValue(mockCarInstance);
        fs.existsSync.mockReturnValue(true); // Image file exists
        fs.unlink.mockImplementation((path, cb) => cb(null)); // Mock successful unlink

        await adminCarController.deleteCar(mockReq, mockRes, mockNext);

        expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('test.jpg'));
        expect(fs.unlink).toHaveBeenCalled();
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'Car deleted successfully.');
    });

    it('should return 404 if car to delete is not found', async () => {
        mockReq.params.id = 'nonExistentId';
        Car.findById.mockResolvedValue(null);
        await adminCarController.deleteCar(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car not found.', 404);
    });
  });
});
