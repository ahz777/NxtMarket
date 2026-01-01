const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureAppDirs() {
  const root = process.cwd();

  ensureDir(path.join(root, 'logs'));
  ensureDir(path.join(root, 'public'));
  ensureDir(path.join(root, 'public', 'images'));
  ensureDir(path.join(root, 'public', 'templates'));
  ensureDir(path.join(root, 'public', 'css'));

  ensureDir(path.join(root, 'public', 'uploads'));
  ensureDir(path.join(root, 'public', 'uploads', 'products'));
}

module.exports = { ensureAppDirs };
