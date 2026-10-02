const express = require('express');
const router = express.Router();
const carController = require('../controllers/carController'); // Public car controller

// @route   GET / (relative to the mount point, e.g., /api/cars/)
// @desc    Display list of available cars with optional search/filter
router.get('/', carController.listAvailableCars);

// @route   GET /:id (e.g., /api/cars/:id)
// @desc    Display details for a specific car
router.get('/:id', carController.showCarDetails);

module.exports = router;
