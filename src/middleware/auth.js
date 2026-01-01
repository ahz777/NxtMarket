const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

function authRequired(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing or invalid Authorization header'));
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, env.jwt.secret);

    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };

    return next();
  } catch (e) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

function requireRole(...roles) {
  const allowed = new Set(roles);
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Unauthorized'));
    if (!allowed.has(req.user.role)) return next(new ApiError(403, 'Forbidden'));
    next();
  };
}

module.exports = { authRequired, requireRole };
