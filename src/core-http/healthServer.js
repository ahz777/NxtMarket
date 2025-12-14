const http = require('http');
const fs = require('fs');
const path = require('path');
function createHealthServer() {
  const port = process.env.HEALTH_PORT || 4000;
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ ok: true, uptime: process.uptime(), memory: process.memoryUsage() })
      );
    } else if (req.url === '/metrics') {
      const logPath = path.join(__dirname, '../../logs/requests.log');
      let size = 0;
      try {
        const stats = fs.statSync(logPath);
        size = stats.size;
      } catch (err) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ requestsLogSize: size }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port, () => console.log(`Health server on :${port}`));
}
module.exports = { createHealthServer };
