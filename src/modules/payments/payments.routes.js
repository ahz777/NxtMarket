const express = require('express');
const { authRequired, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validate');
const controller = require('./payments.controller');

const router = express.Router();

router.post(
  '/intents',
  authRequired,
  requireRole('user', 'admin'),
  validateBody(['orderId']),
  controller.createIntent
);

router.post('/webhook', controller.webhook);

module.exports = router;
