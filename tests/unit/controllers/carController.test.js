// tests/unit/controllers/carController.test.js
const carController = require('../../../controllers/carController'); // Adjust path
const Car = require('../../../models/Car');
const { successResponse, errorResponse } = require('../../../utils/apiResponse');

jest.mock('../../../models/Car', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../../../utils/apiResponse', () => ({
  successResponse: jest.fn(),
  errorResponse: jest.fn(),
}));

describe('Public Car Controller', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { query: {}, params: {} }; // query for list, params for detail
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    
    // Clear mocks
    Car.find.mockClear();
    Car.findById.mockClear();
    Car.countDocuments.mockClear();
    successResponse.mockClear();
    errorResponse.mockClear();
  });

  // --- listAvailableCars ---
  describe('listAvailableCars', () => {
    it('should fetch and return available cars with default pagination', async () => {
      const mockCars = [{ make: 'Toyota', model: 'Camry' }, { make: 'Honda', model: 'Civic' }];
      Car.find.mockReturnValue({ // Mock chained Mongoose query methods
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCars)
      });
      Car.countDocuments.mockResolvedValue(2);

      await carController.listAvailableCars(mockReq, mockRes, mockNext);

      expect(Car.find).toHaveBeenCalledWith({ status: 'available' });
      expect(Car.countDocuments).toHaveBeenCalledWith({ status: 'available' });
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Available cars fetched.', 
        expect.objectContaining({
          cars: mockCars,
          pagination: expect.objectContaining({ currentPage: 1, totalPages: 1, totalCars: 2, limit: 10 }),
          filtersApplied: {}
        })
      );
    });

    it('should handle search query parameters', async () => {
        mockReq.query = { search: 'Toyota', page: '1', limit: '5' };
        const mockFilteredCars = [{ make: 'Toyota', model: 'Corolla' }];
        Car.find.mockReturnValue({ 
            skip: jest.fn().mockReturnThis(), 
            limit: jest.fn().mockResolvedValue(mockFilteredCars) 
        });
        Car.countDocuments.mockResolvedValue(1);

        await carController.listAvailableCars(mockReq, mockRes, mockNext);
        
        const expectedQuery = {
            status: 'available',
            $or: [
                { make: new RegExp('Toyota', 'i') },
                { model: new RegExp('Toyota', 'i') }
            ]
        };
        expect(Car.find).toHaveBeenCalledWith(expectedQuery);
        expect(Car.countDocuments).toHaveBeenCalledWith(expectedQuery);
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'Available cars fetched.', 
            expect.objectContaining({
                cars: mockFilteredCars,
                pagination: expect.objectContaining({ currentPage: 1, totalPages: 1, totalCars: 1, limit: 5 }),
                filtersApplied: { search: 'Toyota' }
            })
        );
    });
    
    it('should handle price filter query parameters', async () => {
        mockReq.query = { minPrice: '50', maxPrice: '100' };
        Car.find.mockReturnValue({ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) });
        Car.countDocuments.mockResolvedValue(0);

        await carController.listAvailableCars(mockReq, mockRes, mockNext);
        
        expect(Car.find).toHaveBeenCalledWith({
            status: 'available',
            pricePerDay: { $gte: 50, $lte: 100 }
        });
    });

    it('should call next with error if Car.find fails', async () => {
      const dbError = new Error('Database find error');
      Car.find.mockReturnValue({ 
        skip: jest.fn().mockReturnThis(), 
        limit: jest.fn().mockRejectedValue(dbError) 
      });
      // No need to mock countDocuments if find already fails before it

      await carController.listAvailableCars(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
    
    it('should return empty array if no cars match criteria', async () => {
        Car.find.mockReturnValue({ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) });
        Car.countDocuments.mockResolvedValue(0);

        await carController.listAvailableCars(mockReq, mockRes, mockNext);
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'Available cars fetched.', 
            expect.objectContaining({
                cars: [],
                pagination: expect.objectContaining({ totalCars: 0, totalPages: 0 })
            })
        );
    });
  });

  // --- showCarDetails ---
  describe('showCarDetails', () => {
    it('should fetch and return details for a specific car', async () => {
      mockReq.params.id = 'carId123';
      const mockCar = { _id: 'carId123', make: 'Toyota', model: 'Camry', status: 'available' };
      Car.findById.mockResolvedValue(mockCar);

      await carController.showCarDetails(mockReq, mockRes, mockNext);

      expect(Car.findById).toHaveBeenCalledWith('carId123');
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Car details fetched.', { car: mockCar });
    });

    it('should return 404 if car not found', async () => {
      mockReq.params.id = 'nonExistentId';
      Car.findById.mockResolvedValue(null);

      await carController.showCarDetails(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car not found.', 404);
    });

    it('should return 400 for invalid car ID format', async () => {
      mockReq.params.id = 'invalidCarIdFormat';
      const idError = new Error('Invalid ID');
      idError.kind = 'ObjectId'; // Simulate Mongoose ObjectId error
      Car.findById.mockRejectedValue(idError);

      await carController.showCarDetails(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car not found (invalid ID format).', 400);
    });
    
    it('should call next with error if Car.findById fails for other reasons', async () => {
      mockReq.params.id = 'carId123';
      const dbError = new Error('Database findById error');
      Car.findById.mockRejectedValue(dbError);

      await carController.showCarDetails(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
