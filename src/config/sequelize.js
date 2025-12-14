const { Sequelize } = require('sequelize');
const { sql } = require('./env');
const sequelize = new Sequelize(sql.database, sql.username, sql.password, {
  host: sql.host,
  dialect: sql.dialect,
});
module.exports = { sequelize };
