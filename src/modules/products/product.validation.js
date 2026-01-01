const ApiError = require('../../utils/ApiError');

function validateCreateProduct(req, _res, next) {
  const { sku, title, price, stock } = req.body;

  const missing = [];
  if (!sku) missing.push('sku');
  if (!title) missing.push('title');
  if (price === undefined) missing.push('price');
  if (stock === undefined) missing.push('stock');

  if (missing.length) return next(new ApiError(400, 'Validation error', { missing }));

  if (Number(price) < 0)
    return next(new ApiError(400, 'Validation error', { field: 'price', rule: '>= 0' }));
  if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
    return next(new ApiError(400, 'Validation error', { field: 'stock', rule: 'integer >= 0' }));
  }

  next();
}

function validateReview(req, _res, next) {
  const { rating, comment } = req.body;

  if (rating === undefined)
    return next(new ApiError(400, 'Validation error', { missing: ['rating'] }));
  const r = Number(rating);

  if (!Number.isFinite(r) || r < 1 || r > 5) {
    return next(
      new ApiError(400, 'Validation error', { field: 'rating', rule: 'number between 1 and 5' })
    );
  }

  if (comment !== undefined && String(comment).length > 2000) {
    return next(
      new ApiError(400, 'Validation error', { field: 'comment', rule: 'max length 2000' })
    );
  }

  next();
}

module.exports = { validateCreateProduct, validateReview };
