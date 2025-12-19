const express = require('express');
const { authRequired, requireRole } = require('../../middleware/auth');
const ordersController = require('./vendor.orders.controller');

const router = express.Router();

router.use(authRequired, requireRole('vendor', 'admin'));

// Vendor orders
router.get('/orders', ordersController.list);
router.get('/orders/:id', ordersController.getById);

module.exports = router;
