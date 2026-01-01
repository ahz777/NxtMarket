const express = require('express');
const { authRequired, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validate');
const controller = require('./order.controller');
const { requireIdempotencyKey } = require('../../middleware/idempotency');

const router = express.Router();

router.post('/', authRequired, requireRole('user'), requireIdempotencyKey, controller.checkout);
router.get('/my', authRequired, requireRole('user'), controller.myOrders);
router.patch('/:id/cancel', authRequired, requireRole('user'), controller.cancel);

router.get('/:id', authRequired, controller.getById);

router.patch(
  '/:id/status',
  authRequired,
  requireRole('admin'),
  validateBody(['status']),
  controller.updateStatus
);

module.exports = router;
