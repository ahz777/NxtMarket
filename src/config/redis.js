const logger = require('./logger');

let redisClient = null;

async function initRedis(redisEnv) {
  if (!redisEnv.enabled) {
    logger.info('Redis disabled');
    return null;
  }

  // Lazy import so the dependency is optional later if you want
  const { createClient } = require('redis');
  redisClient = createClient({ url: redisEnv.url });

  redisClient.on('error', (err) => {
    logger.error('Redis error', { message: err.message });
  });

  await redisClient.connect();
  logger.info('Redis connected');

  return redisClient;
}

function getRedis() {
  return redisClient;
}

module.exports = { initRedis, getRedis };
