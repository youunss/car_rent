// tests/unit/controllers/admin/bookingController.test.js
const adminBookingController = require('../../../../controllers/admin/bookingController'); // Adjust path
const Booking = require('../../../../models/Booking');
// const Car = require('../../../../models/Car'); // If testing side-effects on Car model
const { successResponse, errorResponse } = require('../../../../utils/apiResponse');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

jest.mock('../../../../models/Booking', () => {
  const mockBooking = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  mockBooking.find = jest.fn();
  mockBooking.findById = jest.fn();
  mockBooking.countDocuments = jest.fn();
  mockBooking.prototype.save = jest.fn();
  return mockBooking;
});
// jest.mock('../../../../models/Car'); 
jest.mock('../../../../utils/apiResponse');
jest.mock('express-validator');

describe('Admin Booking Controller', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { 
      body: {}, 
      params: {}, 
      query: {}, // For filtering/pagination
      session: { user: { id: 'adminUserId', role: 'admin' } } 
    };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    
    Booking.find.mockClear();
    Booking.findById.mockClear();
    Booking.countDocuments.mockClear();
    // Ensure prototype.save is defined if Booking is a class mock
    if (Booking.prototype && Booking.prototype.save) Booking.prototype.save.mockClear(); else Booking.prototype.save = jest.fn();

    successResponse.mockClear();
    errorResponse.mockClear();
    validationResult.mockClear();
     // Mock Booking.schema.path('status').enumValues if needed for validation tests
    Booking.schema = { path: jest.fn().mockReturnValue({ enumValues: ['pending', 'confirmed', 'cancelled', 'completed', 'declined'] }) };

  });

  // --- getAllBookings ---
  describe('getAllBookings', () => {
    it('should fetch and return all bookings with default pagination/sorting', async () => {
      const mockBookings = [{ _id: 'b1' }, { _id: 'b2' }];
      // Mock the chained Mongoose call
      const mockQuery = {
        populate: jest.fn().mockReturnThis(), // For user
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockBookings)
      };
      // The second populate call for 'car' needs to be chained from the first 'populate'
      mockQuery.populate.mockReturnValueOnce(mockQuery); // First populate ('user') returns mockQuery
      mockQuery.populate.mockReturnValueOnce(mockQuery); // Second populate ('car') returns mockQuery
      
      Booking.find.mockReturnValue(mockQuery);
      Booking.countDocuments.mockResolvedValue(2);

      await adminBookingController.getAllBookings(mockReq, mockRes, mockNext);

      expect(Booking.find).toHaveBeenCalledWith({}); // Default empty query
      expect(mockQuery.populate).toHaveBeenCalledWith('user', 'username email');
      expect(mockQuery.populate).toHaveBeenCalledWith('car', 'make model year');
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 }); // Default sort
      expect(mockQuery.skip).toHaveBeenCalledWith(0); // Default page 1, limit 10
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(Booking.countDocuments).toHaveBeenCalledWith({});
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'All bookings fetched successfully.', 
        expect.objectContaining({
          bookings: mockBookings,
          pagination: expect.objectContaining({ currentPage: 1, totalPages: 1, totalBookings: 2, limit: 10 })
        })
      );
    });

    it('should handle filter query parameters (e.g., status)', async () => {
        mockReq.query = { status: 'pending', page: '1', limit: '5' };
        const mockFilteredBookings = [{ _id: 'bPending', status: 'pending' }];
        const mockQuery = {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockFilteredBookings)
        };
        mockQuery.populate.mockReturnValueOnce(mockQuery);
        mockQuery.populate.mockReturnValueOnce(mockQuery);

        Booking.find.mockReturnValue(mockQuery);
        Booking.countDocuments.mockResolvedValue(1);

        await adminBookingController.getAllBookings(mockReq, mockRes, mockNext);
        
        const expectedQuery = { status: 'pending' };
        expect(Booking.find).toHaveBeenCalledWith(expectedQuery);
        expect(Booking.countDocuments).toHaveBeenCalledWith(expectedQuery);
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'All bookings fetched successfully.', 
            expect.objectContaining({
                bookings: mockFilteredBookings,
                pagination: expect.objectContaining({ currentPage: 1, totalPages: 1, totalBookings: 1, limit: 5 })
            })
        );
    });

    it('should call next with error if Booking.find fails', async () => {
      const dbError = new Error('Database find error');
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(dbError)
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      Booking.find.mockReturnValue(mockQuery);

      await adminBookingController.getAllBookings(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // --- updateBookingStatus ---
  describe('updateBookingStatus', () => {
    let mockBookingInstance;

    beforeEach(() => {
      validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
      mockBookingInstance = { 
        _id: 'bookingToUpdate', 
        status: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(mockBookingInstance),
        catch: (reject) => {}
      };
      // Default findById for successful update
      Booking.findById.mockReturnValue(mockQuery); 
      validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    });
    
    it('should update booking status successfully', async () => {
      mockReq.params.id = 'bookingToUpdate';
      mockReq.body = { status: 'confirmed' };

      await adminBookingController.updateBookingStatus(mockReq, mockRes, mockNext);

      expect(Booking.findById).toHaveBeenCalledWith('bookingToUpdate'); // Initial fetch
      expect(mockBookingInstance.status).toBe('confirmed'); // Check status was updated before save
      expect(mockBookingInstance.save).toHaveBeenCalled();
      expect(successResponse).toHaveBeenCalledWith(mockRes, "Booking status updated to 'confirmed'.", 
        expect.objectContaining({ 
            booking: expect.objectContaining({ status: 'confirmed' }) 
        })
      );
    });

    it('should return validation errors if present (e.g. invalid status value)', async () => {
      mockReq.params.id = 'bookingToUpdate';
      mockReq.body = { status: 'invalidStatusValue' };
      const mockErrors = [{ msg: 'Invalid status', param: 'status' }];
      validationResult.mockReturnValue({ isEmpty: () => false, array: () => mockErrors });
      
      await adminBookingController.updateBookingStatus(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Validation failed.', 422, mockErrors);
    });

    it('should return 404 if booking not found for status update', async () => {
      mockReq.params.id = 'notFoundBooking';
      mockReq.body = { status: 'confirmed' };
      Booking.findById.mockResolvedValue(null); // Booking not found
      await adminBookingController.updateBookingStatus(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Booking not found.', 404);
    });

    it('should return 400 for illogical status transition (e.g., completed to pending)', async () => {
        mockReq.params.id = 'completedBookingId';
        mockReq.body = { status: 'pending' };
        Booking.findById.mockResolvedValue({ _id: 'completedBookingId', status: 'completed', save: jest.fn() });
        await adminBookingController.updateBookingStatus(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, "Cannot change status of a booking that is already 'completed'.", 400);
    });
    
    it('should call next(err) if save fails during status update', async () => {
        mockReq.params.id = 'bookingToUpdate';
        mockReq.body = { status: 'confirmed' };
        const dbError = new Error("Save failed");
        const failingSaveInstance = { 
            _id: 'bookingToUpdate', 
            status: 'pending', 
            save: jest.fn().mockRejectedValue(dbError)
        };
        Booking.findById.mockResolvedValue(failingSaveInstance);
        
        await adminBookingController.updateBookingStatus(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(dbError);
    });

  });
});
