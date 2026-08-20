// scripts/serve-dist.mjs
//
// A static server for dist/ that resolves paths the same way Vercel does, so the
// prerendered HTML can be verified with curl before anything is deployed:
//
//   1. redirects from vercel.json, in order, first match wins
//   2. exact file            /faqs.html
//   3. directory index       /faqs -> /faqs/index.html
//   4. rewrites from vercel.json, which is where the SPA shell is named
//   5. anything left         -> /404.html with a real 404 status
//
// It reads vercel.json rather than reimplementing it, because the thing worth
// catching before a deploy is a rule that was written wrong. Step 5 is the one
// that matters most: for months every unknown URL was answered 200 with the
// noindex shell, so a wrong URL looked alive to Vercel and dead to Google. A
// route that should 404 and does not is now visible from curl.
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

const VERCEL = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));

/* vercel.json sources are path-to-regexp. Only the two forms this project uses
   are supported: :name for one segment and :name* for the rest of the path. */
function toRegExp(source) {
  const body = source
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)\*/g, '(?<$1>.*)')
    .replace(/:(\w+)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${body}$`);
}
const compile = (list) => (list || []).map((r) => ({ ...r, re: toRegExp(r.source) }));
const REDIRECTS = compile(VERCEL.redirects);
const REWRITES = compile(VERCEL.rewrites);

function match(list, pathname) {
  for (const r of list) {
    const m = r.re.exec(pathname);
    if (!m) continue;
    let dest = r.destination;
    for (const [k, v] of Object.entries(m.groups || {})) dest = dest.replace(`:${k}*`, v).replace(`:${k}`, v);
    return { ...r, dest };
  }
  return null;
}

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
  const redirect = match(REDIRECTS, url.pathname);
  if (redirect) {
    res.writeHead(redirect.statusCode || 307, { Location: redirect.dest }).end();
    return;
  }

  const rewrite = match(REWRITES, url.pathname);
  const pathname = rewrite ? rewrite.dest : url.pathname;
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const target = join(DIST, rel);
  if (!target.startsWith(DIST)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  const found = (await tryFile(target)) || (await tryFile(join(target, 'index.html')));

  /* Nothing on disk and no rewrite claimed it. That is a miss, and a miss is a
     404, not a 200 carrying the shell. */
  if (!found) {
    const notFound = await tryFile(join(DIST, '404.html'));
    const body = notFound ? await readFile(notFound) : 'not found';
    res.writeHead(404, { 'Content-Type': notFound ? TYPES['.html'] : 'text/plain' });
    res.end(body);
    return;
  }

  const body = await readFile(found);
  res.writeHead(200, { 'Content-Type': TYPES[extname(found)] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, () => console.log(`serving dist/ on http://127.0.0.1:${PORT}`));
