const asyncHandler = require('../../utils/asyncHandler');
const service = require('./order.service');
const ApiError = require('../../utils/ApiError');

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
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

const checkout = asyncHandler(async (req, res) => {
  const { IdempotencyKey } = req.app.locals.models;

  const key = req.idempotencyKey;
  const endpoint = 'POST /api/orders';
  const userId = String(req.user.id);

  const existing = await IdempotencyKey.findByPk(key);
  if (
    existing &&
    existing.userId === userId &&
    existing.endpoint === endpoint &&
    existing.response
  ) {
    return res.status(existing.statusCode || 200).json(existing.response);
  }

  if (existing && (existing.userId !== userId || existing.endpoint !== endpoint)) {
    throw new ApiError(409, 'Idempotency-Key already used');
  }

  await IdempotencyKey.upsert({
    key,
    userId,
    endpoint,
    response: null,
    statusCode: null,
  });

  const result = await service.checkout({
    userId: req.user.id,
    sequelize: req.app.locals.sequelize,
    models: req.app.locals.models,
  });

  await IdempotencyKey.update({ response: result, statusCode: 201 }, { where: { key } });

  res.status(201).json(result);
});

const myOrders = asyncHandler(async (req, res) => {
  const result = await service.listMyOrders({
    userId: req.user.id,
    models: req.app.locals.models,
    limit: req.query.limit,
    page: req.query.page,
  });

  res.json({
    items: result.items.map(pickOrder),
    total: result.total,
    page: result.page,
    limit: result.limit,
    pages: result.pages,
  });
});

const getById = asyncHandler(async (req, res) => {
  const result = await service.getOrderDetails({
    orderId: req.params.id,
    requester: req.user,
    models: req.app.locals.models,
  });

  res.json({
    order: pickOrder(result.order),
    items: result.items.map(pickItem),
  });
});

const updateStatus = asyncHandler(async (req, res) => {
  const order = await service.updateStatus({
    orderId: req.params.id,
    status: req.body.status,
    requester: req.user,
    models: req.app.locals.models,
  });

  res.json({ order: pickOrder(order) });
});

const cancel = asyncHandler(async (req, res) => {
  const order = await service.cancelOrderByUser({
    orderId: req.params.id,
    requester: req.user,
    models: req.app.locals.models,
  });

  res.json({
    order: {
      id: order.id,
      userId: order.userId,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

module.exports = { checkout, myOrders, getById, updateStatus, cancel };
