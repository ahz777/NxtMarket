const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const { authRequired } = require('./middleware/auth');

const productRoutes = require('./modules/products/product.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/orders/order.routes');
const uploadsRoutes = require('./modules/uploads/uploads.routes');
const uploadsAttachRoutes = require('./modules/uploads/uploads.attach.routes');
const vendorRoutes = require('./modules/vendor/vendor.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');

const { generalLimiter, authLimiter, webhookLimiter } = require('./middleware/rateLimiters');

function createApp({ corsOrigin }) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin }));
  app.use(generalLimiter);

  app.use(requestLogger());

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/public', express.static('public'));

  app.get('/api/ping', (req, res) => {
    res.json({ ok: true, name: 'nxtmarket', ts: new Date().toISOString() });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/uploads', uploadsAttachRoutes);
  app.use('/api/vendor', vendorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/payments/webhook', webhookLimiter);

  app.get('/api/whoami', authRequired, (req, res) => {
    res.json({ user: req.user });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
