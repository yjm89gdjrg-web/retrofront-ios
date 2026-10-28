import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve('ios/RetroFront/Game');
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary',
};
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg']);
const cache = new Map();

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    let data = await readFile(file);
    const ext = path.extname(file);
    const headers = {
      'Content-Type': types[ext] || 'text/plain',
      'Cache-Control': 'no-store',
    };
    if (compressible.has(ext) && (req.headers['accept-encoding'] || '').includes('gzip')) {
      let gz = cache.get(file);
      if (!gz) { gz = zlib.gzipSync(data, { level: 6 }); cache.set(file, gz); }
      data = gz;
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }
    headers['Content-Length'] = data.length;
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
