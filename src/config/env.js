const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  healthPort: Number(process.env.HEALTH_PORT || 5001),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  mongoUri: process.env.MONGO_URI,

  sql: {
    host: process.env.SQL_HOST,
    port: Number(process.env.SQL_PORT || 5432),
    db: process.env.SQL_DB,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    logging: String(process.env.SQL_LOGGING || 'false').toLowerCase() === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  redis: {
    enabled: String(process.env.REDIS_ENABLED || 'false').toLowerCase() === 'true',
    url: process.env.REDIS_URL,
  },
};

function assertRequired() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.sql.host) missing.push('SQL_HOST');
  if (!env.sql.db) missing.push('SQL_DB');
  if (!env.sql.user) missing.push('SQL_USER');
  if (!env.sql.password) missing.push('SQL_PASSWORD');
  if (!env.jwt.secret) missing.push('JWT_SECRET');

  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

module.exports = { env, assertRequired };
