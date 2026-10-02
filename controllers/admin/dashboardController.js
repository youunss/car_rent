const User = require('../../models/User');
const Car = require('../../models/Car');
const Booking = require('../../models/Booking');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

exports.getDashboardStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' }); // Count only 'user' role
        const totalAdmins = await User.countDocuments({ role: 'admin' });
        
        const totalCars = await Car.countDocuments();
        const carsAvailable = await Car.countDocuments({ status: 'available' });
        const carsBooked = await Car.countDocuments({ status: 'booked' }); // Note: 'booked' status on Car model might be simplistic
        const carsMaintenance = await Car.countDocuments({ status: 'maintenance' });

        const totalBookings = await Booking.countDocuments();
        const bookingsPending = await Booking.countDocuments({ status: 'pending' });
        const bookingsConfirmed = await Booking.countDocuments({ status: 'confirmed' });
        const bookingsCompleted = await Booking.countDocuments({ status: 'completed' });
        const bookingsCancelled = await Booking.countDocuments({ status: 'cancelled' });
        
        // Fetch recent bookings (e.g., last 5, sorted by creation date)
        const recentBookings = await Booking.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'username')
            .populate('car', 'make model');

        // Basic revenue calculation (example: sum of totalPrice for 'completed' bookings)
        // This is a simple sum; real revenue might be more complex.
        const revenueData = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
        ]);
        const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

        const stats = {
            users: { total: totalUsers, admins: totalAdmins },
            cars: { total: totalCars, available: carsAvailable, booked: carsBooked, maintenance: carsMaintenance },
            bookings: { 
                total: totalBookings, 
                pending: bookingsPending, 
                confirmed: bookingsConfirmed, 
                completed: bookingsCompleted,
                cancelled: bookingsCancelled
            },
            recentBookings: recentBookings,
            revenue: {
                totalCompletedRevenue: totalRevenue
            }
        };

        return successResponse(res, 'Dashboard statistics fetched successfully.', { stats });

    } catch (err) {
        return next(err);
    }
};
