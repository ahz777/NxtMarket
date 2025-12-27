const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { env, assertRequired } = require('../config/env');
const { connectMongo } = require('../config/mongoose');
const { createSequelize, connectSql } = require('../config/sequelize');
const { runMigrations } = require('../db/umzug');

const User = require('../modules/users/user.model');
const Product = require('../modules/products/product.model');

// SQL models needed to satisfy app.locals style (not strictly required for seeding users/products)
const defineOrder = require('../modules/orders/order.model');
const defineOrderItem = require('../modules/orders/orderItem.model');
const defineIdempotencyKey = require('../modules/payments/idempotency.model');
const definePaymentIntent = require('../modules/payments/paymentIntent.model');
const defineAuditLog = require('../modules/audit/audit.model');

async function upsertUser({ name, email, role, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, email: normalizedEmail, role, passwordHash });
}

async function main() {
  assertRequired();

  // SQL: migrate
  const sequelize = createSequelize(env.sql);
  await connectSql(sequelize);
  await runMigrations(sequelize);

  // Define models to ensure Sequelize ENUM types stay consistent (optional)
  defineOrder(sequelize);
  defineOrderItem(sequelize);
  defineIdempotencyKey(sequelize);
  definePaymentIntent(sequelize);
  defineAuditLog(sequelize);

  // Mongo: connect + seed
  await connectMongo(env.mongoUri);

  const admin = await upsertUser({
    name: 'Admin',
    email: 'admin@nxtmarket.local',
    role: 'admin',
    password: 'AdminPass123',
  });

  const vendor = await upsertUser({
    name: 'Vendor One',
    email: 'vendor@nxtmarket.local',
    role: 'vendor',
    password: 'VendorPass123',
  });

  const user = await upsertUser({
    name: 'User One',
    email: 'user@nxtmarket.local',
    role: 'user',
    password: 'UserPass123',
  });

  // Sample products (only if none exist for vendor)
  const existingCount = await Product.countDocuments({ vendorId: vendor._id });
  if (existingCount === 0) {
    await Product.create([
      {
        sku: 'NX-2001',
        title: 'Nxt Mouse',
        description: 'Wireless mouse',
        price: 25,
        stock: 50,
        vendorId: vendor._id,
        categories: ['electronics', 'accessories'],
        images: [],
      },
      {
        sku: 'NX-2002',
        title: 'Nxt Headset',
        description: 'Over-ear headset',
        price: 80,
        stock: 30,
        vendorId: vendor._id,
        categories: ['electronics', 'audio'],
        images: [],
      },
    ]);
  }

  // Output credentials
  // eslint-disable-next-line no-console
  console.log('Seed complete:');
  console.log('admin:', admin.email, 'password:', 'AdminPass123');
  console.log('vendor:', vendor.email, 'password:', 'VendorPass123');
  console.log('user:', user.email, 'password:', 'UserPass123');

  await sequelize.close();
  await mongoose.connection.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
