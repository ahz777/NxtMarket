function notFound(req, res, next) {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
}

module.exports = notFound;
