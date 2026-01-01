const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

const Cart = require('./cart.model');
const Product = require('../products/product.model');

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId, items: [] });
  return cart;
}

async function getCart(userId) {
  const cart = await getOrCreateCart(userId);

  await cart.populate({
    path: 'items.productId',
    select: 'sku title price stock images vendorId ratingAvg ratingCount',
  });

  return cart;
}

async function addItem(userId, { productId, qty }) {
  if (!isObjectId(productId)) throw new ApiError(400, 'Invalid productId');

  const q = Number(qty ?? 1);
  if (!Number.isInteger(q) || q < 1)
    throw new ApiError(400, 'Validation error', { field: 'qty', rule: 'integer >= 1' });

  const product = await Product.findById(productId).select('stock');
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.stock < q) throw new ApiError(409, 'Insufficient stock');

  const cart = await getOrCreateCart(userId);

  const idx = cart.items.findIndex((i) => String(i.productId) === String(productId));
  if (idx >= 0) {
    const newQty = cart.items[idx].qty + q;
    if (product.stock < newQty) throw new ApiError(409, 'Insufficient stock');
    cart.items[idx].qty = newQty;
  } else {
    cart.items.push({ productId, qty: q });
  }

  await cart.save();
  return getCart(userId);
}

async function updateQty(userId, productId, { qty }) {
  if (!isObjectId(productId)) throw new ApiError(400, 'Invalid productId');

  const q = Number(qty);
  if (!Number.isInteger(q) || q < 1)
    throw new ApiError(400, 'Validation error', { field: 'qty', rule: 'integer >= 1' });

  const product = await Product.findById(productId).select('stock');
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.stock < q) throw new ApiError(409, 'Insufficient stock');

  const cart = await getOrCreateCart(userId);
  const idx = cart.items.findIndex((i) => String(i.productId) === String(productId));
  if (idx < 0) throw new ApiError(404, 'Item not in cart');

  cart.items[idx].qty = q;
  await cart.save();
  return getCart(userId);
}

async function removeItem(userId, productId) {
  if (!isObjectId(productId)) throw new ApiError(400, 'Invalid productId');

  const cart = await getOrCreateCart(userId);
  cart.items = cart.items.filter((i) => String(i.productId) !== String(productId));
  await cart.save();
  return getCart(userId);
}

async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  await cart.save();
  return getCart(userId);
}

module.exports = { getCart, addItem, updateQty, removeItem, clearCart };
