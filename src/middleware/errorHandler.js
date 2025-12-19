const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;

  logger.error('Unhandled error', {
    status,
    message: err.message,
    details: err.details,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  res.status(status).json({
    message: err.message || 'Internal Server Error',
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = errorHandler;
