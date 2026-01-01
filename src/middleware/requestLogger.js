const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

function requestLogger() {
  const logPath = path.join(process.cwd(), 'logs', 'requests.log');
  const stream = fs.createWriteStream(logPath, { flags: 'a' });

  return morgan('combined', { stream });
}

module.exports = requestLogger;
