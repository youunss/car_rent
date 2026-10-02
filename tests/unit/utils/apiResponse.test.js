const { successResponse, errorResponse } = require('../../../utils/apiResponse'); // Adjust path

describe('API Response Utilities', () => {
  let mockResponse;

  beforeEach(() => {
    // Create a mock Express response object for each test
    mockResponse = {
      status: jest.fn().mockReturnThis(), // mockReturnThis allows chaining e.g. res.status().json()
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('successResponse', () => {
    it('should send a success response with default status 200 and message', () => {
      const data = { id: 1, name: 'Test' };
      successResponse(mockResponse, 'Operation successful', data);
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Operation successful',
        data: data,
      });
    });

    it('should send a success response with a custom status code and message', () => {
      const data = { id: 2 };
      const message = 'Resource created';
      const statusCode = 201;
      successResponse(mockResponse, message, data, statusCode);

      expect(mockResponse.status).toHaveBeenCalledWith(statusCode);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: message,
        data: data,
      });
    });

    it('should send a success response with default message if message is null', () => {
      const data = { key: 'value' };
      successResponse(mockResponse, null, data, 200); // Pass null as message
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ // Check partial object if default message can vary
          status: 'success',
          data: data,
        })
      );
      // Check if message property is present and is a string (the default message)
      const calledWith = mockResponse.json.mock.calls[0][0];
      expect(calledWith).toHaveProperty('message');
      expect(typeof calledWith.message).toBe('string');
    });
    
    it('should send a success response with null data if data is not provided', () => {
      successResponse(mockResponse, 'Fetched successfully');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Fetched successfully',
        data: null, // Or check if data property is absent if that's the implementation
      });
    });
  });

  describe('errorResponse', () => {
    it('should send an error response with default status 400 and message', () => {
      errorResponse(mockResponse, 'An error occurred');

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'An error occurred',
      });
    });

    it('should send an error response with a custom status code and message', () => {
      const message = 'Resource not found';
      const statusCode = 404;
      errorResponse(mockResponse, message, statusCode);

      expect(mockResponse.status).toHaveBeenCalledWith(statusCode);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: message,
      });
    });

    it('should send an error response with an errors array if provided', () => {
      const message = 'Validation failed';
      const statusCode = 422;
      const errors = [{ field: 'email', message: 'Invalid email' }];
      errorResponse(mockResponse, message, statusCode, errors);

      expect(mockResponse.status).toHaveBeenCalledWith(statusCode);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: message,
        errors: errors,
      });
    });
    
    it('should send an error response with default message if message is null', () => {
      errorResponse(mockResponse, null, 500); // Pass null as message
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
       expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
      const calledWith = mockResponse.json.mock.calls[0][0];
      expect(calledWith).toHaveProperty('message');
      expect(typeof calledWith.message).toBe('string'); // Check default message is a string
    });
  });
});
