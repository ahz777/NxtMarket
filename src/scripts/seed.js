const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { env, assertRequired } = require('../config/env');
const { connectMongo } = require('../config/mongoose');
const { createSequelize, connectSql } = require('../config/sequelize');

const User = require('../modules/users/user.model');
const Product = require('../modules/products/product.model');

const defineOrder = require('../modules/orders/order.model');
const defineOrderItem = require('../modules/orders/orderItem.model');
const defineIdempotencyKey = require('../modules/payments/idempotency.model');
const definePaymentIntent = require('../modules/payments/paymentIntent.model');
const defineAuditLog = require('../modules/audit/audit.model');

function loadJson(relPath) {
  const filePath = path.join(__dirname, '..', '..', relPath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function upsertUser({ name, email, role, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, email: normalizedEmail, role, passwordHash });
}

async function main() {
  assertRequired();

  const mongoSeed = loadJson('data/seed-mongo.json');
  const sqlSeed = loadJson('data/seed-sql.json');

  const sequelize = createSequelize(env.sql);
  await connectSql(sequelize);

  const Order = defineOrder(sequelize);
  const OrderItem = defineOrderItem(sequelize);
  const IdempotencyKey = defineIdempotencyKey(sequelize);
  const PaymentIntent = definePaymentIntent(sequelize);
  const AuditLog = defineAuditLog(sequelize);

  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

  await sequelize.sync();

  await connectMongo(env.mongoUri);

  const usersByEmail = {};
  const usersBySlug = {};

  for (const u of mongoSeed.users) {
    const created = await upsertUser(u);
    usersByEmail[created.email] = created;
    const slug = String(u.name || u.email)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    usersBySlug[slug] = created;
  }

  const vendor =
    Object.values(usersByEmail).find((u) => u.role === 'vendor') ||
    Object.values(usersByEmail).find((u) => u.role === 'admin');
  if (!vendor) throw new Error('No vendor/admin user available to assign products.');

  const productDocs = [];
  for (const p of mongoSeed.products) {
    const doc = {
      sku: String(p.sku).trim().toUpperCase(),
      title: String(p.title).trim(),
      description: p.description ? String(p.description).trim() : '',
      price: Number(p.price),
      stock: Number(p.stock),
      vendorId: vendor._id,
      images: Array.isArray(p.images) ? p.images.map(String) : [],
      categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
    };

    const upserted = await Product.findOneAndUpdate(
      { sku: doc.sku },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    productDocs.push(upserted);
  }

  const productBySku = productDocs.reduce((acc, prod) => {
    acc[prod.sku] = prod;
    return acc;
  }, {});

  const ordersCreated = [];
  for (const order of sqlSeed.orders) {
    let userId = order.userId;
    const match = typeof userId === 'string' ? userId.match(/^mongo_user_id_(.+)$/) : null;
    if (match) {
      const slug = match[1].toLowerCase();
      userId = usersBySlug[slug]?._id || userId;
    }

    const createdOrder = await Order.create({
      userId: String(userId),
      status: order.status || 'PENDING',
      total: Number(order.total || 0),
    });
    ordersCreated.push(createdOrder);
  }

  for (const item of sqlSeed.orderItems) {
    const order = ordersCreated[item.orderIndex];
    if (!order) continue;
    const product = productBySku[String(item.productSku).trim().toUpperCase()];
    const vendorId = product?.vendorId || vendor._id;

    await OrderItem.create({
      orderId: order.id,
      productSku: String(item.productSku).trim().toUpperCase(),
      title: item.title,
      price: Number(item.price),
      qty: Number(item.qty),
      vendorId: String(vendorId),
    });
  }

  console.log('Seed complete. Users:');
  mongoSeed.users.forEach((u) => console.log('-', u.email, 'password:', u.password));

  await sequelize.close();
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
