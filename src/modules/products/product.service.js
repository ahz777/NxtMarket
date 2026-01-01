const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const Product = require('./product.model');

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeSku(sku) {
  return String(sku).trim().toUpperCase();
}

function normalizeCategories(categories) {
  if (!categories) return [];
  if (Array.isArray(categories)) return categories.map((c) => String(c).trim()).filter(Boolean);
  return String(categories)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

function normalizeImages(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images.map(String).filter(Boolean);
  return [String(images)];
}

async function createProduct({ vendorId, body }) {
  const doc = {
    sku: normalizeSku(body.sku),
    title: String(body.title).trim(),
    description: body.description ? String(body.description).trim() : '',
    price: Number(body.price),
    stock: Number(body.stock),
    vendorId,
    images: normalizeImages(body.images),
    categories: normalizeCategories(body.categories),
  };

  try {
    const created = await Product.create(doc);
    return created;
  } catch (e) {
    if (e?.code === 11000) throw new ApiError(409, 'SKU already exists');
    throw e;
  }
}

async function getProductById(id) {
  if (!isObjectId(id)) throw new ApiError(400, 'Invalid product id');
  const p = await Product.findById(id);
  if (!p) throw new ApiError(404, 'Product not found');
  return p;
}

function buildCatalogQuery(query) {
  const filter = {};

  if (query.vendorId) {
    if (!isObjectId(query.vendorId)) throw new ApiError(400, 'Invalid vendorId');
    filter.vendorId = query.vendorId;
  }

  if (query.q) {
    filter.$text = { $search: String(query.q).trim() };
  }

  if (query.category) {
    filter.categories = String(query.category).trim();
  }

  if (query.inStock === 'true') {
    filter.stock = { $gt: 0 };
  }

  const minPrice = query.minPrice !== undefined ? Number(query.minPrice) : undefined;
  const maxPrice = query.maxPrice !== undefined ? Number(query.maxPrice) : undefined;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined && Number.isFinite(minPrice)) filter.price.$gte = minPrice;
    if (maxPrice !== undefined && Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
    if (Object.keys(filter.price).length === 0) delete filter.price;
  }

  return filter;
}

function buildSort(sort) {
  switch (sort) {
    case 'price_asc':
      return { price: 1, _id: 1 };
    case 'price_desc':
      return { price: -1, _id: 1 };
    case 'rating_desc':
      return { ratingAvg: -1, ratingCount: -1, _id: 1 };
    case 'stock_desc':
      return { stock: -1, _id: 1 };
    case 'newest':
    default:
      return { createdAt: -1, _id: 1 };
  }
}

async function listProducts(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit || 12)));
  const skip = (page - 1) * limit;

  const filter = buildCatalogQuery(query);
  const sort = buildSort(query.sort);

  const findQuery = Product.find(filter).sort(sort).skip(skip).limit(limit);

  const [items, total] = await Promise.all([findQuery, Product.countDocuments(filter)]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

async function updateProduct({ productId, requester, body }) {
  const p = await getProductById(productId);

  if (requester.role !== 'admin' && String(p.vendorId) !== String(requester.id)) {
    throw new ApiError(403, 'Forbidden');
  }

  const patch = {};
  if (body.sku !== undefined) patch.sku = normalizeSku(body.sku);
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.description !== undefined) patch.description = String(body.description).trim();
  if (body.price !== undefined) patch.price = Number(body.price);
  if (body.stock !== undefined) patch.stock = Number(body.stock);
  if (body.images !== undefined) patch.images = normalizeImages(body.images);
  if (body.categories !== undefined) patch.categories = normalizeCategories(body.categories);

  if (patch.price !== undefined && patch.price < 0)
    throw new ApiError(400, 'Validation error', { field: 'price', rule: '>= 0' });
  if (patch.stock !== undefined && (!Number.isInteger(patch.stock) || patch.stock < 0)) {
    throw new ApiError(400, 'Validation error', { field: 'stock', rule: 'integer >= 0' });
  }

  try {
    const updated = await Product.findByIdAndUpdate(p._id, { $set: patch }, { new: true });
    return updated;
  } catch (e) {
    if (e?.code === 11000) throw new ApiError(409, 'SKU already exists');
    throw e;
  }
}

async function deleteProduct({ productId, requester }) {
  const p = await getProductById(productId);

  if (requester.role !== 'admin' && String(p.vendorId) !== String(requester.id)) {
    throw new ApiError(403, 'Forbidden');
  }

  await Product.deleteOne({ _id: p._id });
  return { deleted: true };
}

async function addReview({ productId, requester, body }) {
  const p = await getProductById(productId);

  const already = p.reviews?.some((r) => String(r.userId) === String(requester.id));
  if (already) throw new ApiError(409, 'You have already reviewed this product');

  const rating = Number(body.rating);
  const comment = body.comment ? String(body.comment).trim() : '';

  p.reviews.push({
    userId: requester.id,
    rating,
    comment,
  });

  const count = p.reviews.length;
  const avg = p.reviews.reduce((sum, r) => sum + r.rating, 0) / count;

  p.ratingCount = count;
  p.ratingAvg = Math.round(avg * 10) / 10;

  await p.save();
  return p;
}

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addReview,
};
