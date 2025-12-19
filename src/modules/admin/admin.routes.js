const express = require('express');
const { authRequired, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validate');
const controller = require('./admin.controller');

const router = express.Router();

router.use(authRequired, requireRole('admin'));

router.get('/orders', controller.listOrders);
router.get('/orders/:id', controller.getOrder);
router.patch('/orders/:id/status', validateBody(['status']), controller.updateOrderStatus);

router.get('/metrics', controller.metrics);

module.exports = router;
