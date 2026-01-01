const asyncHandler = require('../../utils/asyncHandler');
const service = require('./vendor.orders.service');

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

const list = asyncHandler(async (req, res) => {
  const result = await service.listVendorOrders({
    vendorId: req.user.id,
    models: req.app.locals.models,
    limit: req.query.limit,
    page: req.query.page,
  });

  res.json({
    items: result.items.map((x) => ({
      order: pickOrder(x.order),
      items: x.items.map(pickItem),
    })),
    total: result.total,
    page: result.page,
    limit: result.limit,
    pages: result.pages,
  });
});

const getById = asyncHandler(async (req, res) => {
  const result = await service.getVendorOrderDetails({
    vendorId: req.user.id,
    orderId: req.params.id,
    models: req.app.locals.models,
  });

  res.json({
    order: pickOrder(result.order),
    items: result.items.map(pickItem),
  });
});

module.exports = { list, getById };
