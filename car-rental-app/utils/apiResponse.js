// car-rental-app/utils/apiResponse.js

/**
 * Sends a standardized success JSON response.
 * @param {object} res - Express response object.
 * @param {string} message - Optional success message.
 * @param {object|array} data - The payload.
 * @param {number} statusCode - HTTP status code (default: 200).
 */
const successResponse = (res, message = 'Operation successful', data = null, statusCode = 200) => {
  const response = {
    status: 'success',
    message: message || 'Operation successful',
    data: data,
  };
  res.status(statusCode).json(response);
};

/**
 * Sends a standardized error JSON response.
 * This is for errors explicitly handled and sent by controller logic.
 * Unhandled errors will be caught by the global error handler in app.js.
 * @param {object} res - Express response object.
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code (default: 400).
 * @param {array} errors - Optional array of specific error details (e.g., validation errors).
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 400, errors = null) => {
  const response = {
    status: 'error',
    message: message || 'An error occurred',
  };
  if (errors) {
    response.errors = errors;
  }
  res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse,
};
