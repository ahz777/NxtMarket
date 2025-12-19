const express = require('express');

const { authRequired, requireRole } = require('../../middleware/auth');
const controller = require('./uploads.controller');
const { uploadProductImages, handleMulterErrors } = require('./uploads.middleware');

const router = express.Router();

/**
 * POST /api/uploads/products
 * form-data:
 *   images: <file> (repeat up to maxFilesPerRequest)
 *
 * Requires vendor/admin (only they can upload product assets).
 */
router.post(
  '/products',
  authRequired,
  requireRole('vendor', 'admin'),
  (req, res, next) =>
    uploadProductImages(req, res, (err) => handleMulterErrors(err, req, res, next)),
  controller.uploadProducts
);

module.exports = router;
