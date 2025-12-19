const express = require('express');

const { authRequired, requireRole } = require('../../middleware/auth');
const { uploadProductImages, handleMulterErrors } = require('./uploads.middleware');
const controller = require('./uploads.attach.controller');

const router = express.Router();

/**
 * POST /api/uploads/products/:productId
 * Upload images and attach them to product.images (vendor owns product or admin).
 */
router.post(
  '/products/:productId',
  authRequired,
  requireRole('vendor', 'admin'),
  (req, res, next) =>
    uploadProductImages(req, res, (err) => handleMulterErrors(err, req, res, next)),
  controller.uploadAndAttachToProduct
);

module.exports = router;
