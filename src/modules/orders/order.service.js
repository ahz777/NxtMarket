const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

const Cart = require('../cart/cart.model');
const Product = require('../products/product.model');
const { getIO } = require('../../sockets/io');
const { STATES, assertTransition } = require('./order.states');
const { writeAudit } = require('../audit/audit.service');

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function unique(arr) {
  return Array.from(new Set(arr));
}

async function getVendorIdsForOrder({ orderId, models }) {
  const { OrderItem } = models;
  const items = await OrderItem.findAll({ where: { orderId } });
  return unique(items.map((i) => String(i.vendorId)));
}

async function decrementStockWithRollback(lines) {
  const decremented = [];

  try {
    for (const l of lines) {
      const res = await Product.updateOne(
        { _id: l.productId, stock: { $gte: l.qty } },
        { $inc: { stock: -l.qty } }
      );

      if (res.modifiedCount !== 1) {
        throw new ApiError(409, `Insufficient stock for SKU ${l.productSku}`);
      }

      decremented.push(l);
    }
  } catch (err) {
    for (const l of decremented) {
      await Product.updateOne({ _id: l.productId }, { $inc: { stock: l.qty } });
    }
    throw err;
  }
}

async function restockBySkus(items) {
  for (const it of items) {
    await Product.updateOne(
      { sku: String(it.productSku).toUpperCase() },
      { $inc: { stock: Number(it.qty) } }
    );
  }
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

async function recomputeOrderShippingStatus(orderId, models) {
  const { Order, OrderItem } = models;
  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const items = await OrderItem.findAll({ where: { orderId } });
  if (!items.length) return order;

  const shippedCount = items.filter((i) => i.fulfillmentStatus === 'SHIPPED').length;

  if (order.status === STATES.PAID || order.status === STATES.PARTIALLY_SHIPPED) {
    if (shippedCount === 0) {
      order.status = STATES.PAID;
    } else if (shippedCount < items.length) {
      order.status = STATES.PARTIALLY_SHIPPED;
    } else {
      order.status = STATES.SHIPPED;
    }
    await order.save();
  }

  return order;
}

async function checkout({ userId, sequelize, models }) {
  const cart = await Cart.findOne({ userId });
  if (!cart || cart.items.length === 0) throw new ApiError(400, 'Cart is empty');

  const productIds = cart.items.map((i) => i.productId);
  for (const pid of productIds) {
    if (!isObjectId(pid)) throw new ApiError(400, 'Invalid productId in cart');
  }

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

  for (const l of lines) {
    const p = productById.get(String(l.productId));
    if (p.stock < l.qty) throw new ApiError(409, `Insufficient stock for SKU ${p.sku}`);
  }

  await decrementStockWithRollback(lines);

  const { Order, OrderItem } = models;
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const created = await sequelize.transaction(async (t) => {
    const order = await Order.create(
      { userId: String(userId), status: STATES.PENDING, total: total.toFixed(2) },
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
        fulfillmentStatus: 'PENDING',
        shippedAt: null,
      })),
      { transaction: t }
    );

    return order;
  });

  await Cart.updateOne({ userId }, { $set: { items: [] } });

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

  await emitLowStockIfNeeded(productIds);

  await writeAudit({
    models,
    actorType: 'user',
    actorId: userId,
    entityType: 'order',
    entityId: created.id,
    action: 'order.created',
    data: { status: created.status, total: created.total },
  });

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

  const desired = String(status).toUpperCase();
  const allowed = new Set(Object.values(STATES));
  if (!allowed.has(desired)) throw new ApiError(400, 'Invalid status');

  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  assertTransition(order.status, desired);

  const from = order.status;
  order.status = desired;
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

  await writeAudit({
    models,
    actorType: 'admin',
    actorId: requester.id,
    entityType: 'order',
    entityId: order.id,
    action: 'order.status_changed',
    data: { from, to: order.status },
  });

  return order;
}

async function cancelOrderByUser({ orderId, requester, models }) {
  const { Order, OrderItem } = models;

  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (String(order.userId) !== String(requester.id)) throw new ApiError(403, 'Forbidden');

  if (order.status !== STATES.PENDING) {
    throw new ApiError(409, 'Only PENDING orders can be cancelled');
  }

  order.status = STATES.CANCELLED;
  await order.save();

  const items = await OrderItem.findAll({ where: { orderId: order.id } });
  await restockBySkus(items.map((i) => ({ productSku: i.productSku, qty: i.qty })));

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

  await writeAudit({
    models,
    actorType: 'user',
    actorId: requester.id,
    entityType: 'order',
    entityId: order.id,
    action: 'order.cancelled',
    data: { restocked: true },
  });

  return order;
}

async function vendorShipItem({ orderId, itemId, requester, models }) {
  const { Order, OrderItem } = models;

  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (![STATES.PAID, STATES.PARTIALLY_SHIPPED].includes(order.status)) {
    throw new ApiError(409, 'Order is not ready for shipping');
  }

  const item = await OrderItem.findByPk(itemId);
  if (!item || String(item.orderId) !== String(orderId))
    throw new ApiError(404, 'Order item not found');

  if (requester.role !== 'admin' && String(item.vendorId) !== String(requester.id)) {
    throw new ApiError(403, 'Forbidden');
  }

  if (item.fulfillmentStatus === 'SHIPPED') return { order, item };

  item.fulfillmentStatus = 'SHIPPED';
  item.shippedAt = new Date();
  await item.save();

  const updatedOrder = await recomputeOrderShippingStatus(orderId, models);

  const io = getIO();
  if (io) {
    io.of('/orders')
      .to(`user:${String(updatedOrder.userId)}`)
      .emit('order_status_changed', {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        userId: String(updatedOrder.userId),
      });

    io.of('/orders')
      .to(`vendor:${String(item.vendorId)}`)
      .emit('order_item_shipped', {
        orderId: updatedOrder.id,
        itemId: item.id,
        vendorId: String(item.vendorId),
      });
  }

  await writeAudit({
    models,
    actorType: requester.role === 'admin' ? 'admin' : 'vendor',
    actorId: requester.id,
    entityType: 'order_item',
    entityId: item.id,
    action: 'order_item.shipped',
    data: { orderId, vendorId: item.vendorId },
  });

  return { order: updatedOrder, item };
}

module.exports = {
  checkout,
  listMyOrders,
  getOrderDetails,
  updateStatus,
  cancelOrderByUser,
  vendorShipItem,
};
