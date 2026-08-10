// scripts/prerender.mjs
//
// Turns the client build into real static HTML, one file per indexable route.
//
// Why this exists: lazybee.sg is a client-rendered SPA, so every URL returned the
// same empty shell. Googlebot eventually renders JavaScript. GPTBot, ClaudeBot,
// PerplexityBot and Google-Extended largely do not, which made the site invisible
// to exactly the search surface we care about. Server-rendered HTML is the fix.
//
// Run as the third step of `npm run build`:
//   1. vite build                              -> dist/ (client bundle + shell)
//   2. vite build --ssr src/entry-server.jsx   -> dist-ssr/entry-server.js
//   3. node scripts/prerender.mjs              -> dist/<route>/index.html
//
// Output layout:
//   dist/index.html            prerendered homepage
//   dist/faqs/index.html       prerendered /faqs, and so on
//   dist/app.html              the untouched SPA shell, noindex, served for
//                              /portal/* and any route we do not prerender
//
// The script fails the build if any route comes out without an <h1>, without
// links, or with a canonical that points somewhere other than itself. Those are
// the three failures that produced the original audit warnings, so they are
// checked here rather than left to be discovered in Search Console months later.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SSR_ENTRY = join(ROOT, 'dist-ssr', 'entry-server.js');

/* ── head construction ────────────────────────────────────────────── */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* JSON-LD sits inside a <script>, so the one thing that can break the page is a
   literal </script> or a lone "<" starting a tag. Escaping those is enough. */
const jsonLd = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/**
 * Everything the shell already declares about this page's identity is removed,
 * so the per-route block below is the only source of truth in the output. Left
 * alone: fonts, favicons, viewport, GTM, charset.
 */
function stripShellSeo(head) {
  return head
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\s+name=["'](description|keywords|robots)["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>\s*/gi, '');
}

function headFor(meta, canonical, schemas, siteName, ogImage) {
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(ogImage)}" />`,
    `<meta property="og:locale" content="en_SG" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
    ...schemas.map((s) => `<script type="application/ld+json">${jsonLd(s)}</script>`),
  ];
  return tags.map((t) => `    ${t}`).join('\n');
}

/* ── verification, run against the bytes we just wrote ────────────── */

function audit(html) {
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, ''])[1];
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    words: text ? text.split(' ').length : 0,
    h1: (body.match(/<h1[\s>]/gi) || []).length,
    links: (body.match(/<a[\s>]/gi) || []).length,
    jsonLdBlocks: (html.match(/application\/ld\+json/gi) || []).length,
    canonical: (html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [, null])[1],
    title: (html.match(/<title>([\s\S]*?)<\/title>/i) || [, null])[1],
  };
}

/* ── main ─────────────────────────────────────────────────────────── */

if (!existsSync(SSR_ENTRY)) {
  console.error(`prerender: missing ${SSR_ENTRY}. Run the ssr build step first.`);
  process.exit(1);
}

/* The shell is the empty SPA document the client build emits. It is read from
   dist/app.html when that exists, because this script overwrites dist/index.html
   with the prerendered homepage: reading index.html on a second run would hand
   every route the homepage's markup. dist/app.html is the copy that stays empty. */
const APP_SHELL = join(DIST, 'app.html');
const shell = readFileSync(existsSync(APP_SHELL) ? APP_SHELL : join(DIST, 'index.html'), 'utf8');

if (!shell.includes('<div id="root"></div>')) {
  console.error(
    'prerender: the shell has no empty <div id="root"></div>. It has probably already ' +
      'been prerendered. Run a clean `npm run build`.',
  );
  process.exit(1);
}

const mod = await import(pathToFileURL(SSR_ENTRY).href);
const { render, ALL_ROUTE_META, PRERENDER_ROUTES, canonicalFor, SITE_NAME, DEFAULT_OG_IMAGE } = mod;

/* The SPA shell, kept as-is for every route we do not prerender. It is marked
   noindex because it has no content: if a crawler ever reaches it directly we
   would rather it index nothing than index an empty page under a real URL.
   /portal/* is served from here, which is what keeps the portal client-only. */
const appShell = shell
  .replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '')
  // No canonical on the shell: it is served under many URLs, and a canonical
  // pointing at the homepage from every one of them is the exact mistake that
  // deindexed the five content pages in the first place.
  .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
  .replace(/<meta\s+property=["']og:url["'][^>]*>\s*/gi, '')
  .replace(/<\/head>/i, '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
writeFileSync(APP_SHELL, appShell);

const results = [];
let helmetWorked = false;
const failures = [];

for (const route of PRERENDER_ROUTES) {
  const meta = ALL_ROUTE_META[route];
  const canonical = canonicalFor(route);
  const { html: appHtml, helmetApplied } = render(route);
  helmetWorked = helmetWorked || helmetApplied;

  const headBlock = headFor(meta, canonical, meta.schema(), SITE_NAME, DEFAULT_OG_IMAGE);

  let page = shell.replace(/<head>([\s\S]*?)<\/head>/i, (_m, head) =>
    `<head>${stripShellSeo(head)}\n${headBlock}\n  </head>`,
  );
  page = page.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

  const outPath = route === '/' ? join(DIST, 'index.html') : join(DIST, route.slice(1), 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, page);

  const a = audit(page);
  results.push({ route, ...a });

  if (a.h1 !== 1) failures.push(`${route}: expected exactly 1 <h1>, found ${a.h1}`);
  if (a.links < 1) failures.push(`${route}: no <a> tags in the server-rendered HTML`);
  if (a.canonical !== canonical) failures.push(`${route}: canonical is ${a.canonical}, expected ${canonical}`);
  if (a.words < 50) failures.push(`${route}: only ${a.words} words of visible text`);
}

/* The sitemap is generated from the same route list the pages are, so it can never
   list a URL that is not prerendered or miss one that is. public/sitemap.xml is
   overwritten here on purpose. */
const CHANGEFREQ = {
  '/': 'weekly',
  '/faqs': 'monthly',
  '/contact': 'monthly',
  '/privacy-policy': 'yearly',
  '/terms-of-service': 'yearly',
  '/cookie-policy': 'yearly',
};
const PRIORITY = {
  '/': '1.0',
  '/faqs': '0.7',
  '/contact': '0.6',
  '/privacy-policy': '0.3',
  '/terms-of-service': '0.3',
  '/cookie-policy': '0.3',
};
const today = new Date().toISOString().slice(0, 10);
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  PRERENDER_ROUTES.map(
    (r) =>
      `  <url><loc>${canonicalFor(r)}</loc><lastmod>${today}</lastmod>` +
      `<changefreq>${CHANGEFREQ[r] || 'monthly'}</changefreq>` +
      `<priority>${PRIORITY[r] || '0.5'}</priority></url>`,
  ).join('\n') +
  '\n</urlset>\n';
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);

const pad = (s, n) => String(s).padEnd(n);
console.log('\nprerender');
console.log(`  ${pad('route', 20)}${pad('words', 8)}${pad('h1', 4)}${pad('links', 7)}${pad('json-ld', 9)}canonical`);
for (const r of results) {
  console.log(`  ${pad(r.route, 20)}${pad(r.words, 8)}${pad(r.h1, 4)}${pad(r.links, 7)}${pad(r.jsonLdBlocks, 9)}${r.canonical}`);
}
console.log(`\n  react-helmet-async emitted tags server-side: ${helmetWorked ? 'yes' : 'no'}`);
console.log(`  dist/app.html written as the noindex shell for /portal/* and unlisted routes`);
console.log(`  dist/sitemap.xml regenerated with ${PRERENDER_ROUTES.length} urls\n`);

if (failures.length) {
  console.error('prerender failed:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
