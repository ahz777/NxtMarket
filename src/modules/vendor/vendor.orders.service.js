const ApiError = require('../../utils/ApiError');

async function listVendorOrders({ vendorId, models, limit = 20, page = 1 }) {
  const { Order, OrderItem } = models;

  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));
  const offset = (p - 1) * l;

  const { rows: vendorItems, count } = await OrderItem.findAndCountAll({
    where: { vendorId: String(vendorId) },
    order: [['createdAt', 'DESC']],
    limit: l,
    offset,
  });

  const orderIds = Array.from(new Set(vendorItems.map((i) => i.orderId)));

  const orders = await Order.findAll({
    where: { id: orderIds },
    order: [['createdAt', 'DESC']],
  });

  const itemsByOrder = new Map();
  for (const it of vendorItems) {
    const arr = itemsByOrder.get(it.orderId) || [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  return {
    items: orders.map((o) => ({
      order: o,
      items: itemsByOrder.get(o.id) || [],
    })),
    total: count,
    page: p,
    limit: l,
    pages: Math.ceil(count / l),
  };
}

async function getVendorOrderDetails({ vendorId, orderId, models }) {
  const { Order, OrderItem } = models;

  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const items = await OrderItem.findAll({ where: { orderId, vendorId: String(vendorId) } });
  if (!items.length) throw new ApiError(403, 'Forbidden');

  return { order, items };
}

module.exports = { listVendorOrders, getVendorOrderDetails };
