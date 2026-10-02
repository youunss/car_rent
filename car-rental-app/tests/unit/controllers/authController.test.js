// tests/unit/controllers/authController.test.js
const authController = require('../../../controllers/authController');
const User = require('../../../models/User');
const { successResponse, errorResponse } = require('../../../utils/apiResponse');

// Mock models and utilities
jest.mock('../../../models/User', () => {
  const mockUser = jest.fn().mockImplementation(function (data) {
    Object.assign(this, { role: 'user', ...data });
    this._id = 'someUserId';
  });
  mockUser.findOne = jest.fn();
  mockUser.findById = jest.fn();
  mockUser.prototype.save = jest.fn().mockResolvedValue(this);
  mockUser.prototype.comparePassword = jest.fn();
  return mockUser;
});
jest.mock('../../../utils/apiResponse', () => ({
  successResponse: jest.fn(),
  errorResponse: jest.fn(),
}));

describe('Auth Controller', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      session: {}, // Mock session object
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      clearCookie: jest.fn(),
    };
    mockNext = jest.fn();
    
    // Clear all mock implementations and calls before each test
    User.findOne.mockClear();
    // Ensure prototype.save and prototype.comparePassword are defined if User is a class mock
    if (User.prototype && User.prototype.save) User.prototype.save.mockClear(); else User.prototype.save = jest.fn();
    if (User.prototype && User.prototype.comparePassword) User.prototype.comparePassword.mockClear(); else User.prototype.comparePassword = jest.fn();
    
    // If User.findById is used (e.g., in changePassword)
    if(User.findById) User.findById.mockClear();


    successResponse.mockClear();
    errorResponse.mockClear();
  });

  // --- registerUser ---
  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      mockReq.body = { username: 'newUser', email: 'new@example.com', password: 'password123', confirmPassword: 'password123' };
      User.findOne.mockResolvedValue(null); // No existing user
      User.prototype.save.mockResolvedValue({ // Mock saved user instance
        _id: 'someUserId',
        username: 'newUser',
        email: 'new@example.com',
        role: 'user'
      });

      await authController.registerUser(mockReq, mockRes, mockNext);

      expect(User.findOne).toHaveBeenCalledTimes(2); // Once for email, once for username
      expect(User.prototype.save).toHaveBeenCalledTimes(1);
      expect(mockReq.session.user).toEqual({ id: 'someUserId', username: 'newUser', email: 'new@example.com' });
      expect(mockReq.session.role).toBe('user');
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'User registered successfully.', 
        { user: { id: 'someUserId', username: 'newUser', email: 'new@example.com', role: 'user' } }, 201);
    });

    it('should return 400 if required fields are missing for registration', async () => {
        mockReq.body = { username: 'test' }; // Missing email, password, confirmPassword
        await authController.registerUser(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Please fill in all fields.', 400);
    });
    
    it('should return 400 if passwords do not match for registration', async () => {
        mockReq.body = { username: 'test', email: 'test@test.com', password: '123', confirmPassword: '456'};
        await authController.registerUser(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Passwords do not match.', 400);
    });

    it('should return 409 if email already exists during registration', async () => {
      mockReq.body = { username: 'newUser', email: 'existing@example.com', password: 'password123', confirmPassword: 'password123' };
      User.findOne.mockResolvedValueOnce({ email: 'existing@example.com' }); // Mock existing email

      await authController.registerUser(mockReq, mockRes, mockNext);

      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'User with that email already exists.', 409);
    });
    
    it('should call next with error if User.save fails', async () => {
        mockReq.body = { username: 'newUser', email: 'new@example.com', password: 'password123', confirmPassword: 'password123' };
        User.findOne.mockResolvedValue(null);
        const saveError = new Error('Database save error');
        User.prototype.save.mockRejectedValue(saveError);

        await authController.registerUser(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(saveError);
    });
  });

  // --- loginUser ---
  describe('loginUser', () => {
    it('should login an existing user successfully', async () => {
      mockReq.body = { email: 'user@example.com', password: 'password123' };
      const mockUserInstance = {
        _id: 'userId123',
        username: 'testUser',
        email: 'user@example.com',
        role: 'user',
        comparePassword: jest.fn().mockResolvedValue(true) // Mock comparePassword method
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUserInstance) });


      await authController.loginUser(mockReq, mockRes, mockNext);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
      expect(mockUserInstance.comparePassword).toHaveBeenCalledWith('password123');
      expect(mockReq.session.user).toEqual({ id: 'userId123', username: 'testUser', email: 'user@example.com' });
      expect(mockReq.session.role).toBe('user');
      expect(successResponse).toHaveBeenCalledWith(mockRes, 'Login successful.', 
        { user: { id: 'userId123', username: 'testUser', email: 'user@example.com', role: 'user' } });
    });

    it('should return 401 if user not found during login', async () => {
      mockReq.body = { email: 'nonexistent@example.com', password: 'password123' };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });


      await authController.loginUser(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Invalid credentials.', 401);
    });

    it('should return 401 if password does not match during login', async () => {
      mockReq.body = { email: 'user@example.com', password: 'wrongPassword' };
      const mockUserInstance = {
        _id: 'userId123',
        username: 'testUser',
        email: 'user@example.com',
        role: 'user',
        comparePassword: jest.fn().mockResolvedValue(false) // Password doesn't match
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUserInstance) });

      await authController.loginUser(mockReq, mockRes, mockNext);
      expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Invalid credentials.', 401);
    });
  });
  
  // --- logoutUser ---
  describe('logoutUser', () => {
    it('should logout user successfully', () => {
        mockReq.session.user = { id: 'testId' }; // Simulate logged-in user
        mockReq.session.destroy = jest.fn(callback => callback(null)); // Mock session.destroy

        authController.logoutUser(mockReq, mockRes, mockNext);

        expect(mockReq.session.destroy).toHaveBeenCalledTimes(1);
        expect(mockRes.clearCookie).toHaveBeenCalledWith('connect.sid');
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'Logout successful.');
    });

    it('should call next with error if session destruction fails', () => {
        mockReq.session.user = { id: 'testId' };
        const destroyError = new Error('Session destroy failed');
        mockReq.session.destroy = jest.fn(callback => callback(destroyError));

        authController.logoutUser(mockReq, mockRes, mockNext);
        
        // As per current authController.logoutUser, it calls next(err)
        expect(mockNext).toHaveBeenCalledWith(destroyError);
        // And does not call errorResponse directly
        expect(errorResponse).not.toHaveBeenCalled();
    });
  });

  // --- getCurrentUser ---
  describe('getCurrentUser', () => {
    it('should return current user if session exists', () => {
        mockReq.session.user = { id: 'testId', username: 'testUser' };
        authController.getCurrentUser(mockReq, mockRes, mockNext);
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'Current user fetched.', { user: mockReq.session.user });
    });

    it('should return null user if no session exists', () => {
        // mockReq.session.user is undefined by default in beforeEach
        authController.getCurrentUser(mockReq, mockRes, mockNext);
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'No active session.', { user: null });
    });
  });

  // --- changePassword ---
  describe('changePassword', () => {
    beforeEach(() => {
        // Ensure User.findById is a mock for this describe block if not globally mocked for all User methods.
        User.findById = jest.fn(); 
    });

    it('should change password successfully', async () => {
        mockReq.session.user = { id: 'userId123' }; 
        mockReq.body = { currentPassword: 'oldPassword', newPassword: 'newPassword123', confirmNewPassword: 'newPassword123' };
        
        const mockUserInstance = {
            _id: 'userId123',
            password: 'hashedOldPassword', // This would be the current hashed password
            comparePassword: jest.fn().mockResolvedValue(true), 
            save: jest.fn().mockResolvedValue(true) 
        };
        User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUserInstance) });

        await authController.changePassword(mockReq, mockRes, mockNext);

        expect(User.findById).toHaveBeenCalledWith('userId123');
        expect(mockUserInstance.comparePassword).toHaveBeenCalledWith('oldPassword');
        expect(mockUserInstance.save).toHaveBeenCalledTimes(1);
        expect(mockUserInstance.password).toBe('newPassword123'); // Check password was set before save (hashing is pre-save)
        expect(successResponse).toHaveBeenCalledWith(mockRes, 'Password changed successfully.');
    });
    
    it('should return 401 if current password is incorrect', async () => {
        mockReq.session.user = { id: 'userId123' };
        mockReq.body = { currentPassword: 'wrongOldPassword', newPassword: 'newPassword123', confirmNewPassword: 'newPassword123' };
        
        const mockUserInstance = {
            _id: 'userId123',
            comparePassword: jest.fn().mockResolvedValue(false) 
        };
        User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUserInstance) });

        await authController.changePassword(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'Incorrect current password.', 401);
    });

    it('should return 400 if new passwords do not match', async () => {
        mockReq.body = { currentPassword: 'old', newPassword: 'new1', confirmNewPassword: 'new2' };
        await authController.changePassword(mockReq, mockRes, mockNext);
        expect(errorResponse).toHaveBeenCalledWith(mockRes, 'New passwords do not match.', 400);
    });
  });

});
