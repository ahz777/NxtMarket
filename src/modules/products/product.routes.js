const express = require('express');

const controller = require('./product.controller');
const { authRequired, requireRole } = require('../../middleware/auth');
const { validateCreateProduct, validateReview } = require('./product.validation');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post(
  '/',
  authRequired,
  requireRole('vendor', 'admin'),
  validateCreateProduct,
  controller.create
);
router.patch('/:id', authRequired, requireRole('vendor', 'admin'), controller.update);
router.delete('/:id', authRequired, requireRole('vendor', 'admin'), controller.remove);

router.post(
  '/:id/reviews',
  authRequired,
  requireRole('user'),
  validateReview,
  controller.addReview
);

module.exports = router;
