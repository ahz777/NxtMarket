const express = require('express');

const { authRequired, requireRole } = require('../../middleware/auth');
const controller = require('./uploads.controller');
const { uploadProductImages, handleMulterErrors } = require('./uploads.middleware');

const router = express.Router();

router.post(
  '/products',
  authRequired,
  requireRole('vendor', 'admin'),
  (req, res, next) =>
    uploadProductImages(req, res, (err) => handleMulterErrors(err, req, res, next)),
  controller.uploadProducts
);

module.exports = router;
