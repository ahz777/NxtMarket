const { env, assertRequired } = require('../config/env');
const { createSequelize, connectSql } = require('../config/sequelize');
const { runMigrations } = require('../db/umzug');
const logger = require('../config/logger');

async function main() {
  assertRequired();

  const sequelize = createSequelize(env.sql);
  await connectSql(sequelize);

  await runMigrations(sequelize);

  await sequelize.close();
  logger.info('Migration runner finished');
}

main().catch((err) => {
  logger.error('Migration runner failed', { message: err.message, stack: err.stack });
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
