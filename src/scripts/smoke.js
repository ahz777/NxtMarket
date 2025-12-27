/* eslint-disable no-console */
const http = require('http');
const crypto = require('crypto');

const { env, assertRequired } = require('../config/env');
const { connectMongo } = require('../config/mongoose');
const { createSequelize, connectSql } = require('../config/sequelize');
const { runMigrations } = require('../db/umzug');

const createApp = require('../app');
const { registerSockets } = require('../sockets');
const { setIO } = require('../sockets/io');
const { Server } = require('socket.io');

// SQL models
const defineOrder = require('../modules/orders/order.model');
const defineOrderItem = require('../modules/orders/orderItem.model');
const defineIdempotencyKey = require('../modules/payments/idempotency.model');
const definePaymentIntent = require('../modules/payments/paymentIntent.model');
const defineAuditLog = require('../modules/audit/audit.model');

async function jsonFetch(baseUrl, path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  assertRequired();

  // DB connect + migrate
  await connectMongo(env.mongoUri);

  const sequelize = createSequelize(env.sql);
  await connectSql(sequelize);
  await runMigrations(sequelize);

  // Define SQL models and expose via app.locals
  const Order = defineOrder(sequelize);
  const OrderItem = defineOrderItem(sequelize);
  const IdempotencyKey = defineIdempotencyKey(sequelize);
  const PaymentIntent = definePaymentIntent(sequelize);
  const AuditLog = defineAuditLog(sequelize);

  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

  const app = createApp({ corsOrigin: env.corsOrigin });
  app.locals.sequelize = sequelize;
  app.locals.models = { Order, OrderItem, IdempotencyKey, PaymentIntent, AuditLog };

  // Start server (ephemeral port)
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.corsOrigin === '*' ? true : env.corsOrigin },
  });
  setIO(io);
  registerSockets(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;

  console.log(`[smoke] server up: ${baseUrl}`);

  // ---- Flow
  const vendor = await jsonFetch(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      name: 'SmokeVendor',
      email: 'smoke.vendor@nxt.local',
      password: 'password123',
      role: 'vendor',
    },
  });
  const vendorToken = vendor.token;

  const user = await jsonFetch(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      name: 'SmokeUser',
      email: 'smoke.user@nxt.local',
      password: 'password123',
      role: 'user',
    },
  });
  const userToken = user.token;

  const product = await jsonFetch(baseUrl, '/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${vendorToken}` },
    body: { sku: 'NX-SMOKE-1', title: 'Smoke Product', price: 10, stock: 5, categories: ['smoke'] },
  });
  const productId = product.product.id;

  await jsonFetch(baseUrl, '/api/cart/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: { productId, qty: 1 },
  });

  const idemKey = `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const order = await jsonFetch(baseUrl, '/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}`, 'Idempotency-Key': idemKey },
  });
  const orderId = order.orderId;

  await jsonFetch(baseUrl, '/api/payments/intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: { orderId },
  });

  // Webhook succeed
  const eventId = `evt_smoke_${Date.now()}`;
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET || env.jwt.secret;
  const signature = crypto
    .createHash('sha256')
    .update(eventId + secret)
    .digest('hex');

  await jsonFetch(baseUrl, '/api/payments/webhook', {
    method: 'POST',
    headers: { 'x-webhook-signature': signature },
    body: { eventId, type: 'payment_succeeded', data: { orderId } },
  });

  // Vendor sees order and ships first item
  const vendorOrders = await jsonFetch(baseUrl, '/api/vendor/orders?page=1&limit=20', {
    headers: { Authorization: `Bearer ${vendorToken}` },
  });

  const entry = vendorOrders.items.find((x) => x.order.id === orderId);
  if (!entry || !entry.items?.length)
    throw new Error('Vendor did not see order items in smoke run');
  const itemId = entry.items[0].id;

  await jsonFetch(baseUrl, `/api/vendor/orders/${orderId}/items/${itemId}/ship`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${vendorToken}` },
  });

  const details = await jsonFetch(baseUrl, `/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  console.log(`[smoke] final order status: ${details.order.status}`);
  console.log('[smoke] OK');

  // shutdown
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
  await io.close();
  // Mongo disconnect is handled by your app lifecycle; if your mongoose connector keeps a global connection,
  // it will close when process exits.
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err.message);
  process.exit(1);
});
