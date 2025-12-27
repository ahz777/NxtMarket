const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');

const createApp = require('../../src/app');
const { runMigrations } = require('../../src/db/umzug');
const { setIO } = require('../../src/sockets/io');

// SQL model definers
const defineOrder = require('../../src/modules/orders/order.model');
const defineOrderItem = require('../../src/modules/orders/orderItem.model');
const defineIdempotencyKey = require('../../src/modules/payments/idempotency.model');
const definePaymentIntent = require('../../src/modules/payments/paymentIntent.model');
const defineAuditLog = require('../../src/modules/audit/audit.model');

/**
 * Drops all tables + enums in the test database, then reruns migrations.
 * This makes test runs deterministic even if the DB already contains objects.
 */
async function resetPostgres(sequelize) {
  const qi = sequelize.getQueryInterface();

  // Drop all tables first
  await qi.dropAllTables();

  // Drop all enum types (Postgres)
  // Only do this in a dedicated test database.
  await sequelize.query(`
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT t.typname
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    GROUP BY t.typname
  )
  LOOP
    EXECUTE 'DROP TYPE IF EXISTS "' || r.typname || '" CASCADE';
  END LOOP;
END $$;
  `);
}

async function createTestContext() {
  // Disable sockets in tests (services safely no-op on null io)
  setIO(null);

  // ---------- Mongo (in-memory)
  const mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();
  await mongoose.connect(mongoUri);

  // ---------- SQL (Postgres)
  // You must provide a real Postgres test DB URL:
  // e.g. postgres://postgres:password@localhost:5432/nxtmarket_test
  const sqlUrl = process.env.TEST_SQL_DATABASE_URL;
  if (!sqlUrl) {
    throw new Error('Missing TEST_SQL_DATABASE_URL for tests (Postgres is required).');
  }

  const sequelize = new Sequelize(sqlUrl, {
    logging: false,
  });

  await sequelize.authenticate();
  await resetPostgres(sequelize);
  await runMigrations(sequelize);

  // Define models for runtime usage via app.locals
  const Order = defineOrder(sequelize);
  const OrderItem = defineOrderItem(sequelize);
  const IdempotencyKey = defineIdempotencyKey(sequelize);
  const PaymentIntent = definePaymentIntent(sequelize);
  const AuditLog = defineAuditLog(sequelize);

  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

  const app = createApp({ corsOrigin: '*' });
  app.locals.sequelize = sequelize;
  app.locals.models = { Order, OrderItem, IdempotencyKey, PaymentIntent, AuditLog };

  return {
    app,
    mongo,
    sequelize,
    models: app.locals.models,
    async cleanup() {
      await sequelize.close();
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}

module.exports = { createTestContext };
