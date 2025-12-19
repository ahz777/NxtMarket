const ApiError = require('../utils/ApiError');

function requireIdempotencyKey(req, _res, next) {
  const key = req.header('Idempotency-Key');
  if (!key || String(key).trim().length < 8) {
    return next(new ApiError(400, 'Missing or invalid Idempotency-Key header'));
  }
  req.idempotencyKey = String(key).trim();
  next();
}

module.exports = { requireIdempotencyKey };
