// tests/unit/controllers/bookingController.test.js
const bookingController = require('../../../controllers/bookingController'); // Adjust path
const Booking = require('../../../models/Booking');
const Car = require('../../../models/Car');
const { successResponse, errorResponse } = require('../../../utils/apiResponse');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

jest.mock('../../../models/Booking', () => {
  const mockBooking = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
  });
  mockBooking.find = jest.fn();
  mockBooking.findOne = jest.fn();
  mockBooking.findById = jest.fn();
  mockBooking.findByIdAndUpdate = jest.fn();
  mockBooking.prototype.save = jest.fn().mockResolvedValue(this);
  return mockBooking;
});
jest.mock('../../../models/Car', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../../utils/apiResponse');
jest.mock('express-validator');

describe('User Booking Controller', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { 
      body: {}, 
      params: {}, 
      session: { user: { id: 'userId123' } } // Simulate logged-in user
    };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    
    // Clear mocks
    Booking.find.mockClear();
    Booking.findOne.mockClear();
    Booking.findById.mockClear();
    // Ensure prototype.save is defined if Booking is a class mock
    if (Booking.prototype && Booking.prototype.save) Booking.prototype.save.mockClear(); else Booking.prototype.save = jest.fn();
    
    Car.findById.mockClear();
    successResponse.mockClear();
    errorResponse.mockClear();
    validationResult.mockClear();
  });

  // --- createBooking ---
  describe('createBooking', () => {
    const futureStart = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
    const futureEnd = new Date(Date.now() + 86400000 * 8).toISOString().split('T')[0];

    beforeEach(() => {
      validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] }); // Default to no validation errors
      // Mock Car.findById to return an available car by default for successful booking tests
      Car.findById.mockResolvedValue({ 
        _id: 'carId456', 
        status: 'available', 
        pricePerDay: 50 
      });
      // Mock Booking.findOne to return no conflicting bookings by default
      Booking.findOne.mockResolvedValue(null);
    });

    it('should create a booking successfully', async () => {
      mockReq.body = { carId: 'carId456', startDate: futureStart, endDate: futureEnd }; // Future date
      const savedBookingInstance = { 
        _id: 'bookingId789', 
        user: 'userId123', 
        car: 'carId456', 
        /* other fields */ 
      };
      // Mock the save method on the Booking instance
      Booking.prototype.save.mockResolvedValue(savedBookingInstance);
      
      // Mock findById for populating response
      // This chained populate mock needs to be robust
      const mockPopulatedBooking = { ...savedBookingInstance, user: { username: 'test'}, car: {make: 'TestCar'} };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockImplementation(function(path) {
          if (path === 'user') {
            this.user = { username: 'test' }; // Simulate populated user
            return this; // Return the object for further chaining
          } else if (path === 'car') {
            this.car = { make: 'TestCar' }; // Simulate populated car
            return Promise.resolve(mockPopulatedBooking); // For the final .exec() or await
          }
          return this;
        })
      });


      await bookingController.createBooking(mockReq, mockRes, mockNext);

      expect(Car.findById).toHaveBeenCalledWith('carId456');
      expect(Booking.findOne).toHaveBeenCalled(); // For conflict check
      expect(Booking.prototype.save).toHaveBeenCalled();
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Booking request created successfully. Awaiting confirmation.', 
        { booking: mockPopulatedBooking }, 201);
    });

    it('should return validation errors if present', async () => {
      const mockErrors = [{ msg: 'Car ID is required', param: 'carId' }];
      validationResult.mockReturnValue({ isEmpty: () => false, array: () => mockErrors });
      
      await bookingController.createBooking(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Validation failed.', 422, mockErrors);
    });

    it('should return 400 if start date is in the past', async () => {
        mockReq.body = { carId: 'carId456', startDate: '2020-01-01', endDate: '2020-01-03' }; // Past date
        await bookingController.createBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Start date cannot be in the past.', 400);
    });

    it('should return 404 if car not found', async () => {
        mockReq.body = { carId: 'nonExistentCar', startDate: futureStart, endDate: futureEnd };
        Car.findById.mockResolvedValue(null); // Car not found
        await bookingController.createBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car not found.', 404);
    });
    
    it('should return 400 if car is not available (simple status check)', async () => {
        mockReq.body = { carId: 'carId456', startDate: futureStart, endDate: futureEnd };
        Car.findById.mockResolvedValue({ _id: 'carId456', status: 'maintenance', pricePerDay: 50 });
        await bookingController.createBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car is not currently available for booking (might be under maintenance or generally unavailable).', 400);
    });

    it('should return 409 if booking conflict exists', async () => {
        mockReq.body = { carId: 'carId456', startDate: futureStart, endDate: futureEnd };
        Booking.findOne.mockResolvedValue({ _id: 'existingBooking' }); // Conflicting booking found
        await bookingController.createBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Car is already booked for the selected dates.', 409);
    });
    
    it('should call next(err) if save fails', async () => {
        mockReq.body = { carId: 'carId456', startDate: futureStart, endDate: futureEnd };
        const dbError = new Error("Save failed");
        Booking.prototype.save.mockRejectedValue(dbError);
        await bookingController.createBooking(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(dbError);
    });

  });

  // --- getUserBookings ---
  describe('getUserBookings', () => {
    it('should fetch and return bookings for the current user', async () => {
      const mockBookings = [{ _id: 'b1' }, { _id: 'b2' }];
      Booking.find.mockReturnValue({ // Mock chained Mongoose query methods
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockBookings)
      });

      await bookingController.getUserBookings(mockReq, mockRes, mockNext);
      expect(Booking.find).toHaveBeenCalledWith({ user: 'userId123' });
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'User bookings fetched successfully.', { bookings: mockBookings });
    });
    
    it('should call next(err) if find fails', async () => {
        const dbError = new Error("DB find failed");
        Booking.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockRejectedValue(dbError)
        });
        await bookingController.getUserBookings(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // --- cancelUserBooking ---
  describe('cancelUserBooking', () => {
    let mockBookingInstance;

    beforeEach(() => {
        mockBookingInstance = { 
            _id: 'bookingToCancel', 
            user: 'userId123', 
            status: 'pending',
            save: jest.fn().mockResolvedValue(true) // Mock save on the instance
        };
        Booking.findById.mockResolvedValue(mockBookingInstance);
        jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
    });

    afterEach(() => {
        mongoose.Types.ObjectId.isValid.mockRestore(); 
    });

    it('should cancel a booking successfully', async () => {
      mockReq.params.id = 'bookingToCancel';
      await bookingController.cancelUserBooking(mockReq, mockRes, mockNext);
      
      expect(Booking.findById).toHaveBeenCalledWith('bookingToCancel');
      expect(mockBookingInstance.status).toBe('cancelled'); // Check status was updated
      expect(mockBookingInstance.save).toHaveBeenCalled(); // Check save was called
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Booking cancelled successfully.', 
        { bookingId: 'bookingToCancel', newStatus: 'cancelled' });
    });

    it('should return 400 for invalid Booking ID format', async () => {
        mongoose.Types.ObjectId.isValid.mockReturnValue(false);
        mockReq.params.id = 'invalidIdFormat';
        await bookingController.cancelUserBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Invalid Booking ID format.', 400);
    });
    
    it('should return 404 if booking not found for cancellation', async () => {
        mockReq.params.id = 'notFoundBooking';
        Booking.findById.mockResolvedValue(null); // Booking not found
        await bookingController.cancelUserBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Booking not found.', 404);
    });

    it('should return 403 if user not authorized to cancel', async () => {
        mockReq.params.id = 'otherUserBooking';
        // Modify the instance returned by findById for this specific test
        Booking.findById.mockResolvedValue({ ...mockBookingInstance, user: 'otherUserId' });
        await bookingController.cancelUserBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'You are not authorized to cancel this booking.', 403);
    });

    it('should return 400 if booking status does not allow cancellation', async () => {
        mockReq.params.id = 'completedBooking';
        // Modify the instance returned by findById for this specific test
        Booking.findById.mockResolvedValue({ ...mockBookingInstance, status: 'completed' });
        await bookingController.cancelUserBooking(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Booking cannot be cancelled as it is already completed.', 400);
    });
  });
});
