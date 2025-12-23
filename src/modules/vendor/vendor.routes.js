const express = require('express');
const { authRequired, requireRole } = require('../../middleware/auth');
const ordersController = require('./vendor.orders.controller');

const fulfillmentController = require('./vendor.fulfillment.controller');

const router = express.Router();

router.use(authRequired, requireRole('vendor', 'admin'));

// Vendor orders
router.get('/orders', ordersController.list);
router.get('/orders/:id', ordersController.getById);

// Ship a specific item (vendor ships only their item)
router.patch('/orders/:orderId/items/:itemId/ship', fulfillmentController.shipItem);

module.exports = router;
