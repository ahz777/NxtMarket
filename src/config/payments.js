const { env } = require('./env');

const paymentsConfig = {
  webhookSecret: process.env.PAYMENTS_WEBHOOK_SECRET || env.jwt.secret,
  provider: 'stub',
};

module.exports = paymentsConfig;
