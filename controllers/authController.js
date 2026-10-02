const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse'); // Import response helpers
// const { validationResult } = require('express-validator'); // Not used in this controller directly, but in routes

// Handle user registration API
exports.registerUser = async (req, res, next) => {
  // Basic validation (can be enhanced with express-validator in routes)
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password || !confirmPassword) {
    return errorResponse(res, 'Please fill in all fields.', 400);
  }
  if (password !== confirmPassword) {
    return errorResponse(res, 'Passwords do not match.', 400);
  }
  if (password.length < 6) {
    return errorResponse(res, 'Password must be at least 6 characters.', 400);
  }

  try {
    let user = await User.findOne({ email });
    if (user) {
      return errorResponse(res, 'User with that email already exists.', 409); // 409 Conflict
    }
    user = await User.findOne({ username });
    if (user) {
      return errorResponse(res, 'User with that username already exists.', 409);
    }

    const newUser = new User({ username, email, password });
    await newUser.save();

    // Log the user in by creating a session
    req.session.user = { id: newUser._id, username: newUser.username, email: newUser.email };
    req.session.role = newUser.role;

    // Prepare user data to send back (excluding password)
    const userToReturn = { 
        id: newUser._id, 
        username: newUser.username, 
        email: newUser.email, 
        role: newUser.role 
    };
    return successResponse(res, 'User registered successfully.', { user: userToReturn }, 201);

  } catch (err) {
    return next(err); 
  }
};

// Handle user login API
exports.loginUser = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return errorResponse(res, 'Please provide email and password.', 400);
  }

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return errorResponse(res, 'Invalid credentials.', 401); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid credentials.', 401);
    }

    // Establish session
    req.session.user = { id: user._id, username: user.username, email: user.email };
    req.session.role = user.role;
    
    const userToReturn = { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
    };
    return successResponse(res, 'Login successful.', { user: userToReturn });

  } catch (err) {
    return next(err);
  }
};

// Handle user logout API
exports.logoutUser = (req, res, next) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Session destruction error:", err);
      return next(err); 
    }
    res.clearCookie('connect.sid'); 
    return successResponse(res, 'Logout successful.');
  });
};

// Get current logged-in user API
exports.getCurrentUser = (req, res) => {
  if (req.session && req.session.user) {
    return successResponse(res, 'Current user fetched.', { user: req.session.user });
  } else {
    return successResponse(res, 'No active session.', { user: null }); 
  }
};

// Change password API
exports.changePassword = async (req, res, next) => {
    // Validation for fields (can also be done via express-validator in routes)
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        return errorResponse(res, 'Please fill in all password fields.', 400);
    }
    if (newPassword !== confirmNewPassword) {
        return errorResponse(res, 'New passwords do not match.', 400);
    }
    if (newPassword.length < 6) { // Consistent with registration
        return errorResponse(res, 'New password must be at least 6 characters long.', 400);
    }

    try {
        // Get user from session and fetch full user object to access password
        const user = await User.findById(req.session.user.id).select('+password');
        if (!user) {
            // This case should ideally not happen if session is valid and user exists
            return errorResponse(res, 'User not found. Please log in again.', 404);
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return errorResponse(res, 'Incorrect current password.', 401);
        }

        // Set and hash new password (Mongoose pre-save hook will hash it)
        user.password = newPassword;
        await user.save();

        return successResponse(res, 'Password changed successfully.');

    } catch (err) {
        return next(err);
    }
};
