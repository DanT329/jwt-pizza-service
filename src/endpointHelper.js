const logger = require('./logger'); // Import logger module
class StatusCodeError extends Error {
  constructor(message, statusCode) {
    super(message);
    logger.errorLogger(this);
    this.statusCode = statusCode;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  asyncHandler,
  StatusCodeError,
};