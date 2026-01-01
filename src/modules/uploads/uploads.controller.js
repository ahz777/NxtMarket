const asyncHandler = require('../../utils/asyncHandler');
const uploadsConfig = require('../../config/uploads');

const uploadProducts = asyncHandler(async (req, res) => {
  const files = req.files || [];

  const uploaded = files.map((f) => ({
    filename: f.filename,
    url: `${uploadsConfig.publicBasePath}/${f.filename}`,
    size: f.size,
    mimetype: f.mimetype,
  }));

  res.status(201).json({ uploaded });
});

module.exports = { uploadProducts };
