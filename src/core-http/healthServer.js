const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

function fileSizeSafe(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function startHealthServer({ healthPort }) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const payload = JSON.stringify({ ok: true, uptime: process.uptime() });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(payload);
      return;
    }

    if (req.url === '/metrics' && req.method === 'GET') {
      const logsDir = path.join(process.cwd(), 'logs');
      const requestsLog = path.join(logsDir, 'requests.log');
      const appLog = path.join(logsDir, 'app.log');

      const payload = JSON.stringify({
        requestsLogSizeBytes: fileSizeSafe(requestsLog),
        appLogSizeBytes: fileSizeSafe(appLog),
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(payload);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
  });

  server.listen(healthPort, () => {
    logger.info(`[health] listening on :${healthPort}`);
  });

  return server;
}

module.exports = { startHealthServer };
