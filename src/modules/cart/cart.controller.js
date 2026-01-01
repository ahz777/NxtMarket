const asyncHandler = require('../../utils/asyncHandler');
const service = require('./cart.service');

const get = asyncHandler(async (req, res) => {
  const cart = await service.getCart(req.user.id);
  res.json({ cart });
});

const addItem = asyncHandler(async (req, res) => {
  const cart = await service.addItem(req.user.id, req.body);
  res.status(201).json({ cart });
});

const updateQty = asyncHandler(async (req, res) => {
  const cart = await service.updateQty(req.user.id, req.params.productId, req.body);
  res.json({ cart });
});

const removeItem = asyncHandler(async (req, res) => {
  const cart = await service.removeItem(req.user.id, req.params.productId);
  res.json({ cart });
});

const clear = asyncHandler(async (req, res) => {
  const cart = await service.clearCart(req.user.id);
  res.json({ cart });
});

module.exports = { get, addItem, updateQty, removeItem, clear };
