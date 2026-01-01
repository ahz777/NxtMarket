const asyncHandler = require('../../utils/asyncHandler');
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
    fulfillmentStatus: i.fulfillmentStatus,
    shippedAt: i.shippedAt,
  };
}

const shipItem = asyncHandler(async (req, res) => {
  const result = await ordersService.vendorShipItem({
    orderId: req.params.orderId,
    itemId: req.params.itemId,
    requester: req.user,
    models: req.app.locals.models,
  });

  res.json({
    order: pickOrder(result.order),
    item: pickItem(result.item),
  });
});

module.exports = { shipItem };
