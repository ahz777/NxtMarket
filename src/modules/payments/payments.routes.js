const express = require('express');
const { authRequired, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validate');
const controller = require('./payments.controller');

const router = express.Router();

// Create an intent (user pays their own order)
router.post(
  '/intents',
  authRequired,
  requireRole('user', 'admin'),
  validateBody(['orderId']),
  controller.createIntent
);

// Webhook (no auth, signature-based)
router.post('/webhook', controller.webhook);

module.exports = router;
