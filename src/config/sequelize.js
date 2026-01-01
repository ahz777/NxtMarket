const { Sequelize } = require('sequelize');
const logger = require('./logger');

function createSequelize(sqlEnv) {
  const logging = sqlEnv.logging ? (msg) => logger.debug(msg) : false;

  const sequelize = new Sequelize(sqlEnv.db, sqlEnv.user, sqlEnv.password, {
    host: sqlEnv.host,
    port: sqlEnv.port,
    dialect: 'postgres',
    logging,
  });

  return sequelize;
}

async function connectSql(sequelize) {
  await sequelize.authenticate();
  logger.info('PostgreSQL connected (Sequelize)');
}

module.exports = { createSequelize, connectSql };
