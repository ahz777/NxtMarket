const asyncHandler = require('../../utils/asyncHandler');
const service = require('./payments.service');

const createIntent = asyncHandler(async (req, res) => {
  const result = await service.createIntent({
    orderId: req.body.orderId,
    requester: req.user,
    models: req.app.locals.models,
  });

  res.status(201).json(result);
});

const webhook = asyncHandler(async (req, res) => {
  const result = await service.handleWebhook({
    headers: req.headers,
    body: req.body,
    models: req.app.locals.models,
  });

  res.json(result);
});

module.exports = { createIntent, webhook };
