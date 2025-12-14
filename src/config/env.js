require('dotenv').config();
module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/nxtmarket',
  sql: {
    database: process.env.SQL_DB || 'nxtmarket',
    username: process.env.SQL_USER || 'root',
    password: process.env.SQL_PASS || '',
    host: process.env.SQL_HOST || 'localhost',
    dialect: process.env.SQL_DIALECT || 'postgres',
  },
  jwtSecret: process.env.JWT_SECRET || 'secret',
};
