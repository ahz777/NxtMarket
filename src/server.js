const http = require('http');
const { Server } = require('socket.io');

const { env, assertRequired } = require('./config/env');
const logger = require('./config/logger');
const { ensureAppDirs } = require('./utils/ensureDirs');
const { connectMongo } = require('./config/mongoose');
const { createSequelize, connectSql } = require('./config/sequelize');
const { initRedis } = require('./config/redis');
const { startHealthServer } = require('./core-http/healthServer');

const createApp = require('./app');
const { registerSockets } = require('./sockets');
const { setIO } = require('./sockets/io');

const defineOrder = require('./modules/orders/order.model');
const defineOrderItem = require('./modules/orders/orderItem.model');

const defineIdempotencyKey = require('./modules/payments/idempotency.model');
const definePaymentIntent = require('./modules/payments/paymentIntent.model');

const defineAuditLog = require('./modules/audit/audit.model');

async function bootstrap() {
  ensureAppDirs();
  assertRequired();

  await connectMongo(env.mongoUri);

  const sequelize = createSequelize(env.sql);
  await connectSql(sequelize);

  const Order = defineOrder(sequelize);
  const OrderItem = defineOrderItem(sequelize);
  const IdempotencyKey = defineIdempotencyKey(sequelize);
  const PaymentIntent = definePaymentIntent(sequelize);

  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

  await sequelize.sync();

  await initRedis(env.redis);

  const app = createApp({ corsOrigin: env.corsOrigin });

  const AuditLog = defineAuditLog(sequelize);

  app.locals.sequelize = sequelize;
  app.locals.models = { Order, OrderItem, IdempotencyKey, PaymentIntent, AuditLog };

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.corsOrigin === '*' ? true : env.corsOrigin },
  });

  setIO(io);
  registerSockets(io);

  startHealthServer({ healthPort: env.healthPort });

  server.listen(env.port, () => {
    logger.info(`API listening on :${env.port}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { message: err.message, stack: err.stack });
  console.error(err);
  process.exit(1);
});
