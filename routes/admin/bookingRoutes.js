const express = require('express');
const router = express.Router();
const adminBookingController = require('../../controllers/admin/bookingController');
const { ensureAuthenticated, isAdmin } = require('../../middleware/authMiddleware');
const { body, param } = require('express-validator');
const Booking = require('../../models/Booking'); // For status enum

// Protect all admin booking routes
router.use(ensureAuthenticated, isAdmin);

// @route   GET / (relative to mount point, e.g., /api/admin/bookings/)
// @desc    Get all bookings
router.get('/', adminBookingController.getAllBookings);

// @route   PUT /:id/status (e.g., /api/admin/bookings/:id/status)
// @desc    Update status of a booking
router.put(
    '/:id/status',
    [
        param('id').isMongoId().withMessage('Valid Booking ID is required.'),
        body('status').notEmpty().isIn(Booking.schema.path('status').enumValues)
            .withMessage('Valid booking status is required.'),
    ],
    adminBookingController.updateBookingStatus
);

module.exports = router;
