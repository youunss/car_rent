const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose'); // For ObjectId validation if needed

exports.createBooking = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed.', 422, errors.array());
    }

    const { carId, startDate, endDate } = req.body;
    const userId = req.session.user.id;

    try {
        // 1. Validate dates further (e.g., startDate not in past, reasonable booking window)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Compare dates only
        if (new Date(startDate) < today) {
            return errorResponse(res, 'Start date cannot be in the past.', 400);
        }
        // End date > start date is handled by express-validator custom rule

        // 2. Fetch the car
        const car = await Car.findById(carId);
        if (!car) {
            return errorResponse(res, 'Car not found.', 404);
        }
        if (car.status !== 'available') {
            // This is a simple status check. Date-based availability is more robust.
            return errorResponse(res, 'Car is not currently available for booking (might be under maintenance or generally unavailable).', 400);
        }

        // 3. Check for booking conflicts for this car
        const conflictingBooking = await Booking.findOne({
            car: carId,
            status: { $in: ['pending', 'confirmed'] }, // Only active bookings cause conflict
            $or: [
                // New booking starts during an existing booking
                { startDate: { $lt: new Date(endDate) }, endDate: { $gt: new Date(startDate) } },
            ]
        });

        if (conflictingBooking) {
            return errorResponse(res, 'Car is already booked for the selected dates.', 409); // 409 Conflict
        }

        // 4. Calculate duration and total price
        const sDate = new Date(startDate);
        const eDate = new Date(endDate);
        const durationDays = Math.ceil((eDate - sDate) / (1000 * 60 * 60 * 24));

        if (durationDays <= 0) {
             return errorResponse(res, 'Booking duration must be at least 1 day.', 400);
        }
        const totalPrice = durationDays * car.pricePerDay;

        // 5. Create and save the new booking
        const newBooking = new Booking({
            user: userId,
            car: carId,
            startDate: sDate,
            endDate: eDate,
            totalPrice,
            status: 'pending' // Default status, admin might confirm
        });
        await newBooking.save();
        
        // Populate car and user details for the response
        const populatedBooking = await Booking.findById(newBooking._id)
            .populate('user', 'username email')
            .populate('car', 'make model year imageURL');

        return successResponse(res, 'Booking request created successfully. Awaiting confirmation.', { booking: populatedBooking }, 201);

    } catch (err) {
        return next(err);
    }
};

exports.getUserBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ user: req.session.user.id })
                                      .populate('car', 'make model year pricePerDay imageURL status')
                                      .sort({ startDate: -1 }); // Sort by most recent start date
        return successResponse(res, 'User bookings fetched successfully.', { bookings });
    } catch (err) {
        return next(err);
    }
};

exports.cancelUserBooking = async (req, res, next) => {
    const bookingId = req.params.id;
    const userId = req.session.user.id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return errorResponse(res, 'Invalid Booking ID format.', 400);
    }

    try {
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return errorResponse(res, 'Booking not found.', 404);
        }

        if (booking.user.toString() !== userId) {
            return errorResponse(res, 'You are not authorized to cancel this booking.', 403); // Forbidden
        }

        // Define which statuses can be cancelled by user
        const cancellableStatuses = ['pending', 'confirmed']; 
        if (!cancellableStatuses.includes(booking.status)) {
            return errorResponse(res, `Booking cannot be cancelled as it is already ${booking.status}.`, 400);
        }
        
        // Optional: Add time-based cancellation rules (e.g., cannot cancel within 24 hours of start_date)
        // const now = new Date();
        // if (booking.startDate <= now || (booking.startDate - now) < (24 * 60 * 60 * 1000) ) {
        //    return errorResponse(res, 'Booking is too close to start date to be cancelled online.', 400);
        // }


        booking.status = 'cancelled';
        await booking.save();
        
        // Optional: If car status was tied to this booking, update car status here.
        // For example, if a 'confirmed' booking made a car 'booked', cancelling it might make the car 'available'.
        // This requires more complex logic if multiple bookings affect a car's general status field.
        // For now, availability is primarily checked by date conflict.

        return successResponse(res, 'Booking cancelled successfully.', { bookingId: booking._id, newStatus: booking.status });

    } catch (err) {
        return next(err);
    }
};
