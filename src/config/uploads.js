const path = require('path');

const uploadsConfig = {
  // where files are physically stored
  productUploadsDir: path.join(process.cwd(), 'public', 'uploads', 'products'),

  // how they are accessed publicly (served by express static /public)
  publicBasePath: '/public/uploads/products',

  // constraints
  maxFileSizeBytes: 5 * 1024 * 1024, // 5MB
  maxFilesPerRequest: 6,
};

module.exports = uploadsConfig;
