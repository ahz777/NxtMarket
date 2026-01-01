const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const isServerError = status >= 500;

  const logPayload = {
    status,
    message: err.message,
    details: err.details,
    path: req.originalUrl,
    method: req.method,
    ...(isServerError ? { stack: err.stack } : {}),
  };

  logger.error('Unhandled error', logPayload);

  res.status(status).json({
    message: err.message || 'Internal Server Error',
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = errorHandler;
