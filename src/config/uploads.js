const path = require('path');

const uploadsConfig = {
  productUploadsDir: path.join(process.cwd(), 'public', 'uploads', 'products'),

  publicBasePath: '/public/uploads/products',

  maxFileSizeBytes: 5 * 1024 * 1024,
  maxFilesPerRequest: 6,
};

module.exports = uploadsConfig;
