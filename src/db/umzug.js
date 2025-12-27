const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const logger = require('../config/logger');

function createMigrator(sequelize) {
  return new Umzug({
    migrations: {
      glob: path.join(__dirname, 'migrations', '*.js'),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: {
      info: (msg) => logger.info(msg),
      warn: (msg) => logger.warn(msg),
      error: (msg) => logger.error(msg),
      debug: (msg) => logger.info(msg),
    },
  });
}

async function runMigrations(sequelize) {
  const migrator = createMigrator(sequelize);
  const pending = await migrator.pending();

  if (pending.length) {
    logger.info(`Running ${pending.length} migration(s)...`);
    await migrator.up();
    logger.info('Migrations complete');
  } else {
    logger.info('No pending migrations');
  }
}

module.exports = { createMigrator, runMigrations };
