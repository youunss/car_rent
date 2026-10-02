const Booking = require('../../models/Booking');
const Car = require('../../models/Car'); // Potentially needed for side-effects on status change
const { successResponse, errorResponse } = require('../../utils/apiResponse');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Get all bookings (admin) with filtering and pagination
exports.getAllBookings = async (req, res, next) => {
    try {
        const { status, userId, carId, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        let query = {};

        if (status) query.status = status;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) query.user = userId;
        if (carId && mongoose.Types.ObjectId.isValid(carId)) query.car = carId;
        // Add date range filters if needed: e.g., startDateGte, endDateLte

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const sortOptions = {};
        if (sortBy) sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const bookings = await Booking.find(query)
                                      .populate('user', 'username email')
                                      .populate('car', 'make model year')
                                      .sort(sortOptions)
                                      .skip(skip)
                                      .limit(limitNum);
        
        const totalBookings = await Booking.countDocuments(query);
        const pagination = {
            currentPage: pageNum,
            totalPages: Math.ceil(totalBookings / limitNum),
            totalBookings: totalBookings,
            limit: limitNum
        };

        return successResponse(res, 'All bookings fetched successfully.', { bookings, pagination });
    } catch (err) {
        return next(err);
    }
};

// Update booking status (admin)
exports.updateBookingStatus = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed.', 422, errors.array());
    }

    const bookingId = req.params.id;
    const { status: newStatus } = req.body; // newStatus from request body

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return errorResponse(res, 'Booking not found.', 404);
        }

        // Current status of the booking
        const currentStatus = booking.status;

        // Prevent nonsensical status changes (e.g., from 'completed' or 'cancelled' back to 'pending')
        if (['completed', 'cancelled'].includes(currentStatus) && newStatus !== currentStatus) {
             return errorResponse(res, `Cannot change status of a booking that is already '${currentStatus}'.`, 400);
        }
        if (currentStatus === 'confirmed' && newStatus === 'pending') {
            return errorResponse(res, `Cannot change status from '${currentStatus}' back to 'pending'. Consider 'declined' or 'cancelled'.`, 400);
        }


        booking.status = newStatus;
        await booking.save();

        // --- Handle Side Effects (e.g., Car status) ---
        // This is a simplified example. Real-world logic might be more complex.
        // For instance, Car.status might not be a single 'booked'/'available' if multiple bookings exist.
        // Date-based conflict checking is generally more reliable for availability.
        
        if (newStatus === 'confirmed') {
            // Potentially mark car as "less available" if car has a general status field.
            // However, our current createBooking relies on date conflict, so this might be minor.
        } else if (newStatus === 'cancelled' || newStatus === 'declined') {
            // If a car was marked 'booked' due to this specific booking being 'confirmed',
            // changing this booking to 'cancelled' or 'declined' *might* make the car 'available' again.
            // This requires checking if other 'confirmed' bookings still exist for the car.
            // For now, we assume car availability is primarily managed by date conflict checks during new booking creation.
        } else if (newStatus === 'completed') {
            // Car associated with this booking has been returned.
        }
        
        const populatedBooking = await Booking.findById(booking._id)
            .populate('user', 'username email')
            .populate('car', 'make model year');


        return successResponse(res, `Booking status updated to '${newStatus}'.`, { booking: populatedBooking });

    } catch (err) {
        return next(err);
    }
};
