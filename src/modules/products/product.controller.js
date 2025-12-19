const asyncHandler = require('../../utils/asyncHandler');
const service = require('./product.service');
const { toProductResponse, toProductDetailsResponse } = require('./product.dto');

const create = asyncHandler(async (req, res) => {
  const created = await service.createProduct({ vendorId: req.user.id, body: req.body });
  res.status(201).json({ product: toProductResponse(created) });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listProducts(req.query);
  res.json({
    items: result.items.map(toProductResponse),
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  });
});

const getById = asyncHandler(async (req, res) => {
  const p = await service.getProductById(req.params.id);
  res.json({ product: toProductDetailsResponse(p) });
});

const update = asyncHandler(async (req, res) => {
  const updated = await service.updateProduct({
    productId: req.params.id,
    requester: req.user,
    body: req.body,
  });
  res.json({ product: toProductResponse(updated) });
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteProduct({ productId: req.params.id, requester: req.user });
  res.json(result);
});

const addReview = asyncHandler(async (req, res) => {
  const updated = await service.addReview({
    productId: req.params.id,
    requester: req.user,
    body: req.body,
  });
  res.status(201).json({ product: toProductDetailsResponse(updated) });
});

module.exports = { create, list, getById, update, remove, addReview };
