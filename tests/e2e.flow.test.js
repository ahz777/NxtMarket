const request = require('supertest');
const crypto = require('crypto');

const { createTestContext } = require('./helpers/testContext');

describe('E2E flow: auth -> products -> cart -> checkout -> payments -> fulfillment', () => {
  let ctx;
  let api;

  let vendorToken;
  let userToken;

  let productId;
  let orderId;
  let itemId;

  beforeAll(async () => {
    process.env.PAYMENTS_WEBHOOK_SECRET =
      process.env.PAYMENTS_WEBHOOK_SECRET || 'test_webhook_secret';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_123';

    ctx = await createTestContext();
    api = request(ctx.app);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  test('register vendor + user', async () => {
    const vendorRes = await api.post('/api/auth/register').send({
      name: 'Vendor',
      email: 'vendor@test.local',
      password: 'password123',
      role: 'vendor',
    });
    expect(vendorRes.status).toBe(201);
    vendorToken = vendorRes.body.token;
    expect(vendorToken).toBeTruthy();

    const userRes = await api.post('/api/auth/register').send({
      name: 'User',
      email: 'user@test.local',
      password: 'password123',
      role: 'user',
    });
    expect(userRes.status).toBe(201);
    userToken = userRes.body.token;
    expect(userToken).toBeTruthy();
  });

  test('vendor creates a product', async () => {
    const res = await api
      .post('/api/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        sku: 'NX-TEST-1',
        title: 'Test Product',
        description: 'Integration test product',
        price: 50,
        stock: 10,
        categories: ['tests'],
      });

    expect(res.status).toBe(201);
    expect(res.body.product).toBeTruthy();
    productId = res.body.product.id;
    expect(productId).toBeTruthy();
  });

  test('public catalog lists the product', async () => {
    const res = await api.get('/api/products?q=Test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((p) => p.id === productId)).toBe(true);
  });

  test('user adds product to cart and checks out idempotently', async () => {
    const addRes = await api
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId, qty: 2 });

    expect(addRes.status).toBe(201);
    expect(addRes.body.cart).toBeTruthy();

    const idemKey = 'idem-test-key-00000001';

    const checkout1 = await api
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', idemKey);

    expect(checkout1.status).toBe(201);
    orderId = checkout1.body.orderId;
    expect(orderId).toBeTruthy();

    // same key => same response (no duplicate orders)
    const checkout2 = await api
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', idemKey);

    expect(checkout2.status).toBe(201);
    expect(checkout2.body.orderId).toBe(orderId);
  });

  test('user creates a payment intent', async () => {
    const res = await api
      .post('/api/payments/intents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ orderId });

    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeTruthy();
    expect(res.body.status).toBe('REQUIRES_PAYMENT');
  });

  test('webhook payment_succeeded moves order to PAID', async () => {
    const eventId = 'evt_test_1';
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET;

    const sig = crypto
      .createHash('sha256')
      .update(eventId + secret)
      .digest('hex');

    const res = await api.post('/api/payments/webhook').set('x-webhook-signature', sig).send({
      eventId,
      type: 'payment_succeeded',
      data: { orderId },
    });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(true);

    const details = await api
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(details.status).toBe(200);
    expect(details.body.order.status).toBe('PAID');
  });

  test('vendor can view their order items and ship one item', async () => {
    const vendorOrders = await api
      .get('/api/vendor/orders?includeItems=true')
      .set('Authorization', `Bearer ${vendorToken}`);

    expect(vendorOrders.status).toBe(200);
    const first = vendorOrders.body.items.find((x) => x.order.id === orderId);
    expect(first).toBeTruthy();
    expect(first.items.length).toBeGreaterThan(0);

    itemId = first.items[0].id;

    const shipRes = await api
      .patch(`/api/vendor/orders/${orderId}/items/${itemId}/ship`)
      .set('Authorization', `Bearer ${vendorToken}`);

    expect(shipRes.status).toBe(200);
    expect(shipRes.body.item.fulfillmentStatus).toBe('SHIPPED');

    // Order should be PARTIALLY_SHIPPED or SHIPPED depending on item count
    const details = await api
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(details.status).toBe(200);
    expect(['PARTIALLY_SHIPPED', 'SHIPPED', 'PAID']).toContain(details.body.order.status);
  });
});
