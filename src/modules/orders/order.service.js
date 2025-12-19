const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

const Cart = require('../cart/cart.model');
const Product = require('../products/product.model');
const { getIO } = require('../../sockets/io');
const { assertTransition } = require('./order.states');

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Atomic decrement in Mongo with stock >= qty guard.
 * We pre-check stock first, then do ordered bulkWrite to avoid partial success.
 */
async function decrementStockOrFail(lines) {
  const ops = lines.map((l) => ({
    updateOne: {
      filter: { _id: l.productId, stock: { $gte: l.qty } },
      update: { $inc: { stock: -l.qty } },
    },
  }));

  const result = await Product.bulkWrite(ops, { ordered: true });
  if (result.modifiedCount !== ops.length) throw new ApiError(409, 'Insufficient stock');
}

async function emitLowStockIfNeeded(productIds, threshold = 5) {
  const io = getIO();
  if (!io) return;

  const products = await Product.find({ _id: { $in: productIds } }).select(
    'sku stock title vendorId'
  );
  for (const p of products) {
    if (p.stock <= threshold) {
      io.of('/orders')
        .to(`vendor:${String(p.vendorId)}`)
        .emit('low_stock', {
          sku: p.sku,
          title: p.title,
          stock: p.stock,
          vendorId: String(p.vendorId),
        });
    }
  }
}

function unique(arr) {
  return Array.from(new Set(arr));
}

async function getVendorIdsForOrder({ orderId, models }) {
  const { OrderItem } = models;
  const items = await OrderItem.findAll({ where: { orderId } });
  return unique(items.map((i) => String(i.vendorId)));
}

async function checkout({ userId, sequelize, models }) {
  // 1) Load cart
  const cart = await Cart.findOne({ userId });
  if (!cart || cart.items.length === 0) throw new ApiError(400, 'Cart is empty');

  const productIds = cart.items.map((i) => i.productId);
  for (const pid of productIds) {
    if (!isObjectId(pid)) throw new ApiError(400, 'Invalid productId in cart');
  }

  // 2) Snapshot products
  const products = await Product.find({ _id: { $in: productIds } }).select(
    'sku title price stock vendorId'
  );
  if (products.length !== productIds.length)
    throw new ApiError(409, 'One or more products no longer exist');

  const productById = new Map(products.map((p) => [String(p._id), p]));

  const lines = cart.items.map((i) => {
    const p = productById.get(String(i.productId));
    if (!p) throw new ApiError(409, 'One or more products no longer exist');
    return {
      productId: p._id,
      productSku: p.sku,
      title: p.title,
      price: Number(p.price),
      qty: Number(i.qty),
      vendorId: String(p.vendorId),
    };
  });

  // 3) Pre-check stock
  for (const l of lines) {
    const p = productById.get(String(l.productId));
    if (p.stock < l.qty) throw new ApiError(409, `Insufficient stock for SKU ${p.sku}`);
  }

  // 4) Decrement stock (Mongo)
  await decrementStockOrFail(lines);

  // 5) Create SQL order (transaction)
  const { Order, OrderItem } = models;

  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const created = await sequelize.transaction(async (t) => {
    const order = await Order.create(
      {
        userId: String(userId),
        status: 'PENDING',
        total: total.toFixed(2),
      },
      { transaction: t }
    );

    await OrderItem.bulkCreate(
      lines.map((l) => ({
        orderId: order.id,
        productSku: l.productSku,
        title: l.title,
        price: l.price.toFixed(2),
        qty: l.qty,
        vendorId: l.vendorId,
      })),
      { transaction: t }
    );

    return order;
  });

  // 6) Clear cart
  await Cart.updateOne({ userId }, { $set: { items: [] } });

  // 7) Emit targeted events (user + all involved vendors)
  const io = getIO();
  if (io) {
    const vendorIds = unique(lines.map((l) => l.vendorId));

    io.of('/orders')
      .to(`user:${String(userId)}`)
      .emit('order_status_changed', {
        orderId: created.id,
        status: created.status,
        userId: String(userId),
      });

    for (const vid of vendorIds) {
      io.of('/orders')
        .to(`vendor:${vid}`)
        .emit('order_created', {
          orderId: created.id,
          userId: String(userId),
        });
    }
  }

  // 8) Low stock warnings (to the right vendor rooms)
  await emitLowStockIfNeeded(productIds);

  return { orderId: created.id, status: created.status, total: created.total };
}

async function listMyOrders({ userId, models, limit = 20, page = 1 }) {
  const { Order } = models;
  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));
  const offset = (p - 1) * l;

  const { rows, count } = await Order.findAndCountAll({
    where: { userId: String(userId) },
    order: [['createdAt', 'DESC']],
    limit: l,
    offset,
  });

  return { items: rows, total: count, page: p, limit: l, pages: Math.ceil(count / l) };
}

async function getOrderDetails({ orderId, requester, models }) {
  const { Order, OrderItem } = models;

  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (requester.role !== 'admin' && String(order.userId) !== String(requester.id)) {
    throw new ApiError(403, 'Forbidden');
  }

  const items = await OrderItem.findAll({ where: { orderId } });
  return { order, items };
}

async function updateStatus({ orderId, status, requester, models }) {
  const { Order } = models;

  if (requester.role !== 'admin') throw new ApiError(403, 'Forbidden');

  const allowed = new Set(['PENDING', 'PAID', 'SHIPPED', 'CANCELLED']);
  if (!allowed.has(status)) throw new ApiError(400, 'Invalid status');

  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  assertTransition(order.status, status);
  order.status = status;
  await order.save();

  const io = getIO();
  if (io) {
    const vendorIds = await getVendorIdsForOrder({ orderId: order.id, models });

    io.of('/orders')
      .to(`user:${String(order.userId)}`)
      .emit('order_status_changed', {
        orderId: order.id,
        status: order.status,
        userId: String(order.userId),
      });

    for (const vid of vendorIds) {
      io.of('/orders')
        .to(`vendor:${vid}`)
        .emit('order_status_changed', {
          orderId: order.id,
          status: order.status,
          userId: String(order.userId),
        });
    }
  }

  return order;
}

module.exports = { checkout, listMyOrders, getOrderDetails, updateStatus };
