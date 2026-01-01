const crypto = require('crypto');
const { validate: uuidValidate } = require('uuid');
const ApiError = require('../../utils/ApiError');
const paymentsConfig = require('../../config/payments');
const { STATES } = require('../orders/order.states');
const { writeAudit } = require('../audit/audit.service');

function createWebhookSignature(eventId, secret = paymentsConfig.webhookSecret) {
  if (!eventId) throw new Error('eventId is required to sign webhook payload');

  return crypto
    .createHash('sha256')
    .update(String(eventId) + secret)
    .digest('hex');
}

function signStubClientSecret() {
  return crypto.randomBytes(24).toString('hex');
}

async function createIntent({ orderId, requester, models }) {
  const { Order, PaymentIntent } = models;

  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (requester.role !== 'admin' && String(order.userId) !== String(requester.id)) {
    throw new ApiError(403, 'Forbidden');
  }

  if (order.status !== STATES.PENDING) {
    throw new ApiError(409, 'Only PENDING orders can be paid');
  }

  const existing = await PaymentIntent.findOne({
    where: { orderId: order.id, status: 'REQUIRES_PAYMENT' },
    order: [['createdAt', 'DESC']],
  });

  if (existing) {
    return {
      intentId: existing.id,
      orderId: existing.orderId,
      amount: existing.amount,
      currency: existing.currency,
      status: existing.status,
      clientSecret: existing.clientSecret,
    };
  }

  const intent = await PaymentIntent.create({
    orderId: order.id,
    userId: String(order.userId),
    provider: paymentsConfig.provider,
    amount: order.total,
    currency: 'USD',
    status: 'REQUIRES_PAYMENT',
    clientSecret: signStubClientSecret(),
  });

  return {
    intentId: intent.id,
    orderId: intent.orderId,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    clientSecret: intent.clientSecret,
  };
}

async function handleWebhook({ headers, body, models }) {
  const signature = headers['x-webhook-signature'];
  const { IdempotencyKey, PaymentIntent, Order } = models;

  const eventId = body?.eventId;
  const type = body?.type;
  const orderId = body?.data?.orderId;
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');

  if (!eventId || !type) throw new ApiError(400, 'Invalid webhook payload');

  const expected = createWebhookSignature(eventId);

  if (!signature || signature !== expected) {
    throw new ApiError(401, 'Invalid webhook signature');
  }

  const key = `webhook:${eventId}`;
  const existing = await IdempotencyKey.findByPk(key);

  if (existing) {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      throw new ApiError(409, 'Webhook replay payload mismatch');
    }

    if (existing.response) return existing.response;
  }

  await IdempotencyKey.upsert({
    key,
    userId: 'webhook',
    endpoint: 'webhook',
    requestHash,
    response: null,
    statusCode: null,
  });

  let response = { ok: true, eventId, processed: false };

  if (type === 'payment_succeeded') {
    if (!orderId) throw new ApiError(400, 'Missing data.orderId');
    if (!uuidValidate(orderId)) throw new ApiError(400, 'Invalid orderId format');

    const order = await Order.findByPk(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const intent = await PaymentIntent.findOne({
      where: { orderId: order.id },
      order: [['createdAt', 'DESC']],
    });
    if (intent && intent.status === 'REQUIRES_PAYMENT') {
      intent.status = 'SUCCEEDED';
      await intent.save();
    }

    if (order.status === STATES.PENDING) {
      order.status = STATES.PAID;
      await order.save();
    }

    await writeAudit({
      models,
      actorType: 'webhook',
      actorId: eventId,
      entityType: 'order',
      entityId: order.id,
      action: `payment.${type}`,
      data: { eventId, newStatus: order.status },
    });

    response = { ok: true, eventId, processed: true, orderId: order.id, newStatus: order.status };
  }

  if (type === 'payment_failed') {
    if (!orderId) throw new ApiError(400, 'Missing data.orderId');
    if (!uuidValidate(orderId)) throw new ApiError(400, 'Invalid orderId format');

    const order = await Order.findByPk(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const intent = await PaymentIntent.findOne({
      where: { orderId: order.id },
      order: [['createdAt', 'DESC']],
    });
    if (intent && intent.status === 'REQUIRES_PAYMENT') {
      intent.status = 'FAILED';
      await intent.save();
    }

    await writeAudit({
      models,
      actorType: 'webhook',
      actorId: eventId,
      entityType: 'order',
      entityId: order.id,
      action: `payment.${type}`,
      data: { eventId, newStatus: order.status },
    });

    response = { ok: true, eventId, processed: true, orderId: order.id, newStatus: order.status };
  }

  if (type === 'payment_refunded') {
    if (!orderId) throw new ApiError(400, 'Missing data.orderId');
    if (!uuidValidate(orderId)) throw new ApiError(400, 'Invalid orderId format');

    const order = await Order.findByPk(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const intent = await PaymentIntent.findOne({
      where: { orderId: order.id },
      order: [['createdAt', 'DESC']],
    });
    if (intent && intent.status === 'SUCCEEDED') {
      intent.status = 'CANCELLED';
      await intent.save();
    }

    const { OrderItem } = models;
    const items = await OrderItem.findAll({ where: { orderId: order.id } });

    if (order.status === STATES.SHIPPED) {
      order.status = STATES.REFUNDED;
      await order.save();
      response = {
        ok: true,
        eventId,
        processed: true,
        orderId: order.id,
        newStatus: order.status,
        restocked: false,
      };
    } else {
      order.status = STATES.REFUNDED;
      await order.save();

      const toRestock = items.filter((i) => i.fulfillmentStatus !== 'SHIPPED');
      const Product = require('../products/product.model');
      for (const it of toRestock) {
        await Product.updateOne(
          { sku: String(it.productSku).toUpperCase() },
          { $inc: { stock: Number(it.qty) } }
        );
      }

      response = {
        ok: true,
        eventId,
        processed: true,
        orderId: order.id,
        newStatus: order.status,
        restocked: true,
      };
    }

    await writeAudit({
      models,
      actorType: 'webhook',
      actorId: eventId,
      entityType: 'order',
      entityId: order.id,
      action: `payment.${type}`,
      data: { eventId, newStatus: order.status },
    });
  }

  await IdempotencyKey.update({ response, statusCode: 200 }, { where: { key } });

  return response;
}

module.exports = { createIntent, handleWebhook, createWebhookSignature };
