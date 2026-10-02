const express = require('express');
const router = express.Router();
const carController = require('../../controllers/admin/carController');
const { ensureAuthenticated, isAdmin } = require('../../middleware/authMiddleware');
const upload = require('../../config/multerConfig');
const { body } = require('express-validator'); // For validation

// Protect all admin car routes
router.use(ensureAuthenticated, isAdmin);

// @route   GET / (relative to the mount point, e.g., /api/admin/cars/)
// @desc    Get list of all cars
router.get('/', carController.listCars);

// @route   GET /:id (e.g., /api/admin/cars/:id)
// @desc    Get details for a single car
router.get('/:id', carController.getCarDetails);

// @route   POST / (e.g., /api/admin/cars/)
// @desc    Add a new car
router.post(
    '/', 
    upload.single('carImage'),
    [
        body('make').notEmpty().withMessage('Make is required.').trim().escape(),
        body('model').notEmpty().withMessage('Model is required.').trim().escape(),
        body('year').notEmpty().withMessage('Year is required.').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage(`Year must be between 1900 and ${new Date().getFullYear() + 1}.`),
        body('pricePerDay').notEmpty().withMessage('Price per day is required.').isFloat({ gt: 0 }).withMessage('Price per day must be a positive number.'),
        body('status').optional().isIn(['available', 'booked', 'maintenance']).withMessage('Invalid status.'),
        body('features').optional().trim().escape()
    ],
    carController.addCar
);

// @route   PUT /:id (e.g., /api/admin/cars/:id)
// @desc    Update an existing car
router.put( 
    '/:id',
    upload.single('carImage'),
    [
        body('make').notEmpty().withMessage('Make is required.').trim().escape(),
        body('model').notEmpty().withMessage('Model is required.').trim().escape(),
        body('year').notEmpty().withMessage('Year is required.').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage(`Year must be between 1900 and ${new Date().getFullYear() + 1}.`),
        body('pricePerDay').notEmpty().withMessage('Price per day is required.').isFloat({ gt: 0 }).withMessage('Price per day must be a positive number.'),
        body('status').optional().isIn(['available', 'booked', 'maintenance']).withMessage('Invalid status.'),
        body('features').optional().trim().escape()
    ],
    carController.editCar
);

// @route   DELETE /:id (e.g., /api/admin/cars/:id)
// @desc    Delete a car
router.delete('/:id', carController.deleteCar);

module.exports = router;
