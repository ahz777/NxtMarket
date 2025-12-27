const request = require('supertest');
const crypto = require('crypto');
const { createTestContext } = require('./helpers/testContext');

describe('Webhook idempotency + replay mismatch', () => {
  let ctx;
  let api;

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

  test('same eventId + different payload => 409', async () => {
    const eventId = 'evt_replay_1';
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
    const sig = crypto
      .createHash('sha256')
      .update(eventId + secret)
      .digest('hex');

    const body1 = {
      eventId,
      type: 'payment_failed',
      data: { orderId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    };
    const body2 = {
      eventId,
      type: 'payment_failed',
      data: { orderId: 'ffffffff-1111-2222-3333-444444444444' },
    };

    const r1 = await api.post('/api/payments/webhook').set('x-webhook-signature', sig).send(body1);
    expect([200, 404]).toContain(r1.status); // likely 404 order not found, but stored idempotency record still exists

    const r2 = await api.post('/api/payments/webhook').set('x-webhook-signature', sig).send(body2);
    expect(r2.status).toBe(409);
    expect(String(r2.body.message || '')).toMatch(/replay/i);
  });
});
