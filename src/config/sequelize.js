const { Sequelize } = require('sequelize');
const logger = require('./logger');

function createSequelize(sqlEnv) {
  const sequelize = new Sequelize(sqlEnv.db, sqlEnv.user, sqlEnv.password, {
    host: sqlEnv.host,
    port: sqlEnv.port,
    dialect: 'postgres',
    logging: (msg) => logger.info(msg),
  });

  return sequelize;
}

async function connectSql(sequelize) {
  await sequelize.authenticate();
  logger.info('PostgreSQL connected (Sequelize)');
}

module.exports = { createSequelize, connectSql };
