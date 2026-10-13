#!/usr/bin/env node
/**
 * خادم معاينة ثابت لملفات dist/ (معاينة الويب فقط).
 * الاستخدام: node scripts/serve-preview.mjs  (المنفذ الافتراضي 8081 أو عبر PORT)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'dist');
const port = Number(process.env.PORT ?? 8081);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, path.normalize(urlPath));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`[preview] serving ${root} on http://0.0.0.0:${port}`);
});
