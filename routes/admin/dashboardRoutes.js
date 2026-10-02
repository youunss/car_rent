const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboardController');
const { ensureAuthenticated, isAdmin } = require('../../middleware/authMiddleware');

// Protect all dashboard routes
router.use(ensureAuthenticated, isAdmin);

// @route   GET /api/admin/dashboard/stats
// @desc    Get dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
