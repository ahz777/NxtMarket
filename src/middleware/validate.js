const ApiError = require('../utils/ApiError');

function validateBody(requiredFields = []) {
  return (req, _res, next) => {
    const missing = requiredFields.filter(
      (f) => req.body?.[f] === undefined || req.body?.[f] === null || req.body?.[f] === ''
    );
    if (missing.length) {
      return next(new ApiError(400, 'Validation error', { missing }));
    }
    next();
  };
}

module.exports = { validateBody };
