const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

// All booking routes require authentication
router.use(ensureAuthenticated);

// @route   POST / (relative to the mount point, e.g., /api/bookings/)
// @desc    Create a new booking
router.post(
    '/',
    [
        body('carId').notEmpty().isMongoId().withMessage('Valid Car ID is required.'),
        body('startDate').notEmpty().isISO8601().toDate().withMessage('Valid Start Date is required.'),
        body('endDate').notEmpty().isISO8601().toDate().withMessage('Valid End Date is required.')
            .custom((value, { req }) => {
                if (new Date(value) <= new Date(req.body.startDate)) {
                    throw new Error('End date must be after start date.');
                }
                return true;
            }),
        // totalPrice will be calculated on backend
    ],
    bookingController.createBooking
);

// @route   GET /my-bookings (e.g., /api/bookings/my-bookings)
// @desc    Get all bookings for the current user
router.get('/my-bookings', bookingController.getUserBookings);

// @route   POST /:id/cancel (e.g., /api/bookings/:id/cancel) (Using POST for state change)
// @desc    Cancel a booking owned by the user
router.post('/:id/cancel', bookingController.cancelUserBooking); // Ensure :id is a MongoId in controller or here

module.exports = router;
