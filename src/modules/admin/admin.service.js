const ApiError = require('../../utils/ApiError');

function parsePagination(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function listOrders({ query, models }) {
  const { Order, OrderItem } = models;
  const { page, limit, offset } = parsePagination(query);

  const where = {};
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.userId) where.userId = String(query.userId);

  const { rows, count } = await Order.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const includeItems = String(query.includeItems || 'false') === 'true';
  let itemsByOrder = new Map();

  if (includeItems && rows.length) {
    const ids = rows.map((o) => o.id);
    const items = await OrderItem.findAll({ where: { orderId: ids } });
    for (const it of items) {
      const arr = itemsByOrder.get(it.orderId) || [];
      arr.push(it);
      itemsByOrder.set(it.orderId, arr);
    }
  }

  return {
    items: rows.map((o) => ({
      order: o,
      items: includeItems ? itemsByOrder.get(o.id) || [] : undefined,
    })),
    total: count,
    page,
    limit,
    pages: Math.ceil(count / limit),
  };
}

async function getOrder({ orderId, models }) {
  const { Order, OrderItem } = models;
  const order = await Order.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const items = await OrderItem.findAll({ where: { orderId } });
  return { order, items };
}

async function metrics({ models }) {
  const { Order } = models;

  const totalOrders = await Order.count();
  const totalRevenueRow = await Order.findAll({
    attributes: [[Order.sequelize.fn('SUM', Order.sequelize.col('total')), 'sumTotal']],
  });

  const sumTotal = totalRevenueRow?.[0]?.get('sumTotal') || '0';
  return { totalOrders, totalRevenue: sumTotal };
}

module.exports = { listOrders, getOrder, metrics };
