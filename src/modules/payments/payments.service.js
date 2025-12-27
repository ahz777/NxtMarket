const crypto = require('crypto');
const { validate: uuidValidate } = require('uuid');
const ApiError = require('../../utils/ApiError');
const paymentsConfig = require('../../config/payments');
const { STATES } = require('../orders/order.states');
const { writeAudit } = require('../audit/audit.service');

/**
 * Deterministic signature used by the webhook stub.
 * Algorithm: sha256(eventId + secret) -> hex
 */
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

  // user can only pay their own order; admin can pay any (optional)
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

/**
 * Webhook stub:
 * - Accepts JSON body:
 *   { eventId, type, data: { orderId } }
 * - Verifies signature placeholder using x-webhook-signature header
 * - Marks payment intent + order as paid when type === "payment_succeeded"
 *
 * Idempotent by eventId using IdempotencyKey table (endpoint "webhook").
 */
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

  // Signature placeholder: require a deterministic match for dev/testing
  // Compute: sha256(eventId + secret)
  const expected = createWebhookSignature(eventId);

  if (!signature || signature !== expected) {
    throw new ApiError(401, 'Invalid webhook signature');
  }

  // Webhook idempotency (by eventId)
  const key = `webhook:${eventId}`;
  const existing = await IdempotencyKey.findByPk(key);

  if (existing) {
    // Replay protection: same eventId must match same payload hash
    if (existing.requestHash && existing.requestHash !== requestHash) {
      throw new ApiError(409, 'Webhook replay payload mismatch');
    }

    // If already processed, return stored response
    if (existing.response) return existing.response;
  }

  // Store/lock early (best effort)
  await IdempotencyKey.upsert({
    key,
    userId: 'webhook',
    endpoint: 'webhook',
    requestHash,
    response: null,
    statusCode: null,
  });

  // Process
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

    // PENDING -> PAID
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

    // Keep order PENDING (buyer can retry)
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
      intent.status = 'CANCELLED'; // provider refunded; we close the intent
      await intent.save();
    }

    // If shipped, we mark REFUNDED but do NOT restock automatically.
    // If not shipped, mark REFUNDED and restock.
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

      // Restock only items not shipped
      const toRestock = items.filter((i) => i.fulfillmentStatus !== 'SHIPPED');
      const Product = require('../products/product.model'); // local require to avoid cycles
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

  // Save webhook idempotency record
  await IdempotencyKey.update({ response, statusCode: 200 }, { where: { key } });

  return response;
}

module.exports = { createIntent, handleWebhook, createWebhookSignature };
