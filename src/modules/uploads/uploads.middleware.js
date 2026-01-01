const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const ApiError = require('../../utils/ApiError');
const uploadsConfig = require('../../config/uploads');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function safeExt(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;
  return ext;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsConfig.productUploadsDir),
  filename: (_req, file, cb) => {
    const ext = safeExt(file.originalname) || '.bin';
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}_${name}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = safeExt(file.originalname);
  if (!ext) return cb(new ApiError(400, 'Only .jpg, .jpeg, .png, .webp files are allowed'));

  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new ApiError(400, 'Only JPEG, PNG, or WEBP images are allowed'));
  }

  cb(null, true);
}

const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: uploadsConfig.maxFileSizeBytes, files: uploadsConfig.maxFilesPerRequest },
}).array('images', uploadsConfig.maxFilesPerRequest);

function handleMulterErrors(err, _req, _res, next) {
  if (!err) return next();

  if (err.name === 'ApiError') return next(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return next(new ApiError(413, 'File too large', { maxBytes: uploadsConfig.maxFileSizeBytes }));
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return next(
      new ApiError(400, 'Too many files', { maxFiles: uploadsConfig.maxFilesPerRequest })
    );
  }

  return next(new ApiError(400, 'Upload failed', { message: err.message }));
}

module.exports = { uploadProductImages, handleMulterErrors };
