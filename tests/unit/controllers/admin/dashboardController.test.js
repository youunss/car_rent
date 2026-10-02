// tests/unit/controllers/admin/dashboardController.test.js
const dashboardController = require('../../../../controllers/admin/dashboardController'); // Adjust path
const User = require('../../../../models/User');
const Car = require('../../../../models/Car');
const Booking = require('../../../../models/Booking');
const { successResponse, errorResponse } = require('../../../../utils/apiResponse');

jest.mock('../../../../models/User', () => ({
  countDocuments: jest.fn(),
}));
jest.mock('../../../../models/Car', () => ({
  countDocuments: jest.fn(),
}));
jest.mock('../../../../models/Booking', () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../../../../utils/apiResponse');

describe('Admin Dashboard Controller', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { session: { user: { id: 'adminUserId', role: 'admin' } } }; // Admin session
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    
    // Clear mocks
    User.countDocuments.mockClear();
    Car.countDocuments.mockClear();
    Booking.countDocuments.mockClear();
    Booking.find.mockClear();
    Booking.aggregate.mockClear();
    successResponse.mockClear();
    errorResponse.mockClear(); // Though not explicitly used by this controller's success path
  });

  describe('getDashboardStats', () => {
    it('should fetch and return all dashboard statistics successfully', async () => {
      // Mock data for counts
      User.countDocuments.mockImplementation(query => {
        if (query.role === 'user') return Promise.resolve(10); // totalUsers
        if (query.role === 'admin') return Promise.resolve(2);  // totalAdmins
        return Promise.resolve(0);
      });
      Car.countDocuments.mockImplementation(query => {
        if (!query || Object.keys(query).length === 0) return Promise.resolve(5); // totalCars
        if (query.status === 'available') return Promise.resolve(3);
        if (query.status === 'booked') return Promise.resolve(1);
        if (query.status === 'maintenance') return Promise.resolve(1);
        return Promise.resolve(0);
      });
      Booking.countDocuments.mockImplementation(query => {
        if (!query || Object.keys(query).length === 0) return Promise.resolve(7); // totalBookings
        if (query.status === 'pending') return Promise.resolve(1);
        if (query.status === 'confirmed') return Promise.resolve(2);
        if (query.status === 'completed') return Promise.resolve(3);
        if (query.status === 'cancelled') return Promise.resolve(1);
        return Promise.resolve(0);
      });

      // Mock data for recent bookings
      const mockRecentBookings = [{ _id: 'rb1' }, { _id: 'rb2' }];
      // Simulate the chained populate calls for Booking.find
      const bookingFindQueryMock = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockImplementation(function(path) {
              // This function will be called for each populate
              // We need to return 'this' (the query mock) for all but the last populate call
              // For the last populate call, we resolve with the final data
              // Assuming 'user' is populated first, then 'car'
              if (this.populate.mock.calls.length < 2) { // If it's the first populate call (user)
                  return this; // Return the query mock for chaining
              } else { // If it's the second populate call (car), resolve the promise
                  return Promise.resolve(mockRecentBookings);
              }
          })
      };
      Booking.find.mockReturnValue(bookingFindQueryMock);
      
      // Mock data for revenue aggregation
      Booking.aggregate.mockResolvedValue([{ _id: null, totalRevenue: 1500 }]);

      await dashboardController.getDashboardStats(mockReq, mockRes, mockNext);

      expect(User.countDocuments).toHaveBeenCalledWith({ role: 'user' });
      expect(User.countDocuments).toHaveBeenCalledWith({ role: 'admin' });
      expect(Car.countDocuments).toHaveBeenCalledWith(); // Total
      expect(Car.countDocuments).toHaveBeenCalledWith({ status: 'available' });
      // ... other car status counts
      expect(Booking.countDocuments).toHaveBeenCalledWith(); // Total
      expect(Booking.countDocuments).toHaveBeenCalledWith({ status: 'pending' });
      // ... other booking status counts
      expect(Booking.find).toHaveBeenCalledWith({}); // For recent bookings
      expect(bookingFindQueryMock.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(bookingFindQueryMock.limit).toHaveBeenCalledWith(5);
      expect(bookingFindQueryMock.populate).toHaveBeenCalledWith('user', 'username');
      expect(bookingFindQueryMock.populate).toHaveBeenCalledWith('car', 'make model');


      expect(Booking.aggregate).toHaveBeenCalledWith([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
      ]);

      const expectedStats = {
        users: { total: 10, admins: 2 },
        cars: { total: 5, available: 3, booked: 1, maintenance: 1 },
        bookings: { total: 7, pending: 1, confirmed: 2, completed: 3, cancelled: 1 },
        recentBookings: mockRecentBookings,
        revenue: { totalCompletedRevenue: 1500 }
      };
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Dashboard statistics fetched successfully.', { stats: expectedStats });
    });

    it('should handle zero revenue correctly', async () => {
      // Setup mocks to return 0 for counts and empty arrays
      User.countDocuments.mockResolvedValue(0);
      Car.countDocuments.mockResolvedValue(0);
      Booking.countDocuments.mockResolvedValue(0);
      
      const bookingFindQueryMockEmpty = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockImplementation(function(path) {
              if (this.populate.mock.calls.length < 2) return this;
              return Promise.resolve([]); // Empty array for recent bookings
          })
      };
      Booking.find.mockReturnValue(bookingFindQueryMockEmpty);
      Booking.aggregate.mockResolvedValue([]); // No completed bookings, so empty array

      await dashboardController.getDashboardStats(mockReq, mockRes, mockNext);

      const expectedStats = {
        users: { total: 0, admins: 0 },
        cars: { total: 0, available: 0, booked: 0, maintenance: 0 },
        bookings: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
        recentBookings: [],
        revenue: { totalCompletedRevenue: 0 } // Should default to 0
      };
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Dashboard statistics fetched successfully.', { stats: expectedStats });
    });

    it('should call next with error if any database operation fails', async () => {
      const dbError = new Error('Database operation failed');
      User.countDocuments.mockRejectedValue(dbError); // Simulate failure on the first DB call

      await dashboardController.getDashboardStats(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
