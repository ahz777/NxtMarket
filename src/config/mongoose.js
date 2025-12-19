const mongoose = require('mongoose');
const logger = require('./logger');

async function connectMongo(mongoUri) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri, {
    autoIndex: true,
  });

  logger.info('MongoDB connected');
}

module.exports = { connectMongo };
