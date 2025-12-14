const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const winston = require('winston');
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const requestStream = fs.createWriteStream(path.join(logDir, 'requests.log'), { flags: 'a' });
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: path.join(logDir, 'app.log') })],
});
module.exports = { logger, requestStream };
