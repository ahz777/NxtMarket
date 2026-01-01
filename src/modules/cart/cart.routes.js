const express = require('express');
const { authRequired, requireRole } = require('../../middleware/auth');
const controller = require('./cart.controller');

const router = express.Router();

router.use(authRequired, requireRole('user'));

router.get('/', controller.get);
router.post('/items', controller.addItem);
router.patch('/items/:productId', controller.updateQty);
router.delete('/items/:productId', controller.removeItem);
router.delete('/', controller.clear);

module.exports = router;
