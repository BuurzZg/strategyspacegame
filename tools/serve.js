// Minimal static file server:  npm start  ->  http://localhost:8080  (PORT=xxxx to change)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.yaml': 'text/yaml; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8' };

http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.resolve(ROOT, '.' + p);
    if (!file.startsWith(ROOT + path.sep) || /[\\/](\.git|node_modules)[\\/]/.test(file)) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`Driftforge running at http://localhost:${PORT}`));
