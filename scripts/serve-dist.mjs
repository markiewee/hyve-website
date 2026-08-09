// scripts/serve-dist.mjs
//
// A static server for dist/ that resolves paths the same way Vercel does, so the
// prerendered HTML can be verified with curl before anything is deployed:
//
//   1. exact file            /faqs.html
//   2. directory index       /faqs -> /faqs/index.html
//   3. fallback              anything else -> /app.html (the noindex SPA shell)
//
// The fallback matters: it is what proves /portal/dashboard is NOT prerendered.
//
// Usage: node scripts/serve-dist.mjs [port]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.argv[2] || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};

async function tryFile(p) {
  try {
    const s = await stat(p);
    if (s.isFile()) return p;
  } catch {
    /* not there */
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // normalize() plus the prefix check keeps ../ out of the served tree
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const target = join(DIST, rel);
  if (!target.startsWith(DIST)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  const found =
    (await tryFile(target)) ||
    (await tryFile(join(target, 'index.html'))) ||
    (await tryFile(join(DIST, 'app.html')));

  if (!found) {
    res.writeHead(404).end('not found');
    return;
  }

  const body = await readFile(found);
  res.writeHead(200, { 'Content-Type': TYPES[extname(found)] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, () => console.log(`serving dist/ on http://127.0.0.1:${PORT}`));
