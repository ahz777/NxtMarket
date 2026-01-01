const asyncHandler = require('../../utils/asyncHandler');
const adminService = require('./admin.service');
const ordersService = require('../orders/order.service');

function pickOrder(o) {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status,
    total: o.total,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
function pickItem(i) {
  return {
    id: i.id,
    orderId: i.orderId,
    productSku: i.productSku,
    title: i.title,
    price: i.price,
    qty: i.qty,
    vendorId: i.vendorId,
  };
}

const listOrders = asyncHandler(async (req, res) => {
  const result = await adminService.listOrders({ query: req.query, models: req.app.locals.models });

  res.json({
    items: result.items.map((x) => ({
      order: pickOrder(x.order),
      ...(x.items ? { items: x.items.map(pickItem) } : {}),
    })),
    total: result.total,
    page: result.page,
    limit: result.limit,
    pages: result.pages,
  });
});

const getOrder = asyncHandler(async (req, res) => {
  const result = await adminService.getOrder({
    orderId: req.params.id,
    models: req.app.locals.models,
  });
  res.json({ order: pickOrder(result.order), items: result.items.map(pickItem) });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await ordersService.updateStatus({
    orderId: req.params.id,
    status: String(req.body.status).toUpperCase(),
    requester: req.user,
    models: req.app.locals.models,
  });
  res.json({ order: pickOrder(order) });
});

const metrics = asyncHandler(async (req, res) => {
  const result = await adminService.metrics({ models: req.app.locals.models });
  res.json(result);
});

module.exports = { listOrders, getOrder, updateOrderStatus, metrics };
