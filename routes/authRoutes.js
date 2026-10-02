const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const { body } = require('express-validator'); // For optional validation

// @route   POST /register
// @desc    Register a new user
router.post('/register', authController.registerUser); 

// @route   POST /login
// @desc    Login user
router.post('/login', authController.loginUser); 

// @route   POST /logout
// @desc    Logout user - should be authenticated
router.post('/logout', ensureAuthenticated, authController.logoutUser);

// @route   GET /current-user
// @desc    Get the current logged-in user's data
router.get('/current-user', authController.getCurrentUser); 

// @route   POST /change-password
// @desc    Change user's password
router.post(
    '/change-password',
    ensureAuthenticated,
    [ // Optional: Add express-validator rules here for newPassword, confirmNewPassword
        body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.'),
        body('confirmNewPassword').custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Confirmation password does not match new password.');
            }
            return true;
        }),
        // Current password validation is handled in controller to check against DB
    ],
    authController.changePassword
);

module.exports = router;
