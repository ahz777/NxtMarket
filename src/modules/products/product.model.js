const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 0, index: true },
    stock: { type: Number, required: true, min: 0, index: true },

    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    images: [{ type: String }],
    categories: [{ type: String, trim: true, index: true }],

    reviews: [reviewSchema],

    ratingAvg: { type: Number, default: 0, min: 0, max: 5, index: true },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ vendorId: 1, price: 1 });
productSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
