const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const generate = require('./api/generate');

const root = __dirname;
const envPath = path.join(root, 'local.env');

function loadLocalEnv() {
  if (!fs.existsSync(envPath)) {
    throw new Error('local.env 文件不存在，请先创建配置文件。');
  }
  const contents = fs.readFileSync(envPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, name, value] = match;
    if (!Object.prototype.hasOwnProperty.call(process.env, name)) process.env[name] = value;
  }
}

loadLocalEnv();

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:3000');

  if (requestUrl.pathname === '/api/generate') {
    return generate(req, res);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  if (requestUrl.pathname !== '/' && requestUrl.pathname !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('页面不存在。');
  }

  const filePath = path.join(root, 'index.html');

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('页面不存在。');
    }
    const contentType = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    res.end(contents);
  });
});

server.listen(3000, '127.0.0.1', () => {
  console.log('小红书标题生成器已启动：http://localhost:3000');
});
