const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const requested = new URL(request.url, 'http://localhost').pathname;
  const filename = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(filename, (error, data) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  });
});
server.listen(Number(process.env.TEST_PORT || 3334), '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
