const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const uploadsConfig = require('../../config/uploads');
const Product = require('../products/product.model');

const uploadAndAttachToProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const files = req.files || [];

  if (!files.length) throw new ApiError(400, 'No files uploaded');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');

  if (req.user.role !== 'admin' && String(product.vendorId) !== String(req.user.id)) {
    throw new ApiError(403, 'Forbidden');
  }

  const urls = files.map((f) => `${uploadsConfig.publicBasePath}/${f.filename}`);

  const set = new Set([...(product.images || []), ...urls]);
  product.images = Array.from(set);

  await product.save();

  res.status(201).json({
    product: {
      id: String(product._id),
      images: product.images,
    },
  });
});

module.exports = { uploadAndAttachToProduct };
