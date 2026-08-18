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

/* Imported from source rather than from the SSR bundle because hiveArticles.js
   is deliberately dependency free and runs in plain Node. The audit below has to
   count words by the same rule the article records were built with, or a Burmese
   article passes one check and fails the other. */
import { countWords } from '../src/lib/hiveArticles.js';

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
  /* Reciprocal hreflang. Google discards a cluster whose members do not all
     point at each other, so these come from the route table rather than from
     anything hand maintained.

     This is also the only reason the unlisted Burmese and Bengali articles are
     findable. Nothing on the site links to them, so their entire route to being
     discovered is a sitemap entry plus being named as an alternate of an English
     page that does have inbound links. Which does mean those URLs appear in the
     English page's markup: as <link> elements in the head, invisible to a reader
     and unclickable in the page, but present in view source. There is no version
     of a working hreflang cluster where they are not. */
  const alternates = (meta.alternates || []).map(
    (a) => `<link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.href)}" />`,
  );
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
    `<meta property="og:locale" content="${esc(meta.ogLocale || 'en_SG')}" />`,
    ...alternates,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
    // Feed autodiscovery. Without this the feed exists but nothing finds it.
    `<link rel="alternate" type="application/rss+xml" title="The Hive" href="https://www.lazybee.sg/feed.xml" />`,
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
    /* countWords, not split(' '), because Burmese does not put spaces between
       words: a whole Burmese article splits into a couple of dozen tokens and
       trips the thin-content check below. */
    words: countWords(text),
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
const { render, ALL_ROUTE_META, PRERENDER_ROUTES, canonicalFor, SITE_NAME, DEFAULT_OG_IMAGE, BASE_URL } = mod;

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

  /* The shell is authored as lang="en". A Burmese page that claims to be English
     is read aloud by a screen reader in the wrong voice, offered the wrong
     Chrome translate prompt, and given a weaker language signal than the
     hreflang cluster is asserting. */
  page = page.replace(/<html\s+lang="[^"]*"/i, `<html lang="${esc(meta.htmlLang || 'en')}"`);

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
  '/developers': 'monthly',
  '/contact': 'monthly',
  '/privacy-policy': 'yearly',
  '/terms-of-service': 'yearly',
  '/cookie-policy': 'yearly',
};
const PRIORITY = {
  '/': '1.0',
  '/faqs': '0.7',
  '/developers': '0.5',
  '/contact': '0.6',
  '/privacy-policy': '0.3',
  '/terms-of-service': '0.3',
  '/cookie-policy': '0.3',
};
const today = new Date().toISOString().slice(0, 10);

/* Every prerendered route, in every language, including the Burmese and Bengali
   articles nothing on the site links to. For those this file is not one
   discovery path among several, it is the only one: an orphan page that is not
   in the sitemap is a page Google has no way to learn exists.

   Each entry also carries its hreflang cluster as xhtml:link, which is Google's
   documented way to declare alternates for pages that are not internally linked.
   The same set is in each page's head; stating it here as well means a crawler
   that reads the sitemap and has not yet fetched the English page still sees the
   relationship. */
const sitemapEntry = (r) => {
  const meta = ALL_ROUTE_META[r] || {};
  const alts = (meta.alternates || [])
    .map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
    .join('');
  return (
    `  <url>\n    <loc>${canonicalFor(r)}</loc>` +
    `\n    <lastmod>${meta.lastmod || today}</lastmod>` +
    `\n    <changefreq>${CHANGEFREQ[r] || 'monthly'}</changefreq>` +
    `\n    <priority>${PRIORITY[r] || '0.5'}</priority>` +
    `${alts}\n  </url>`
  );
};

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
  ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  PRERENDER_ROUTES.map(sitemapEntry).join('\n') +
  '\n</urlset>\n';
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);


/* ── RSS ──────────────────────────────────────────────────────────────
   A blog without a feed is invisible to readers, aggregators and the AI
   crawlers robots.txt deliberately welcomes. Built from the same ARTICLES the
   site renders so it can never describe posts that are not there. */
const xmlEsc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const rssDate = (d) => new Date(`${d}T09:00:00+08:00`).toUTCString();
/* Built from ALL_ROUTE_META rather than from the markdown, so the feed can only
   ever describe pages the site actually renders. An article route is one whose
   meta declares ogType 'article'; its date and tags are read back out of the
   Article JSON-LD that already sits in its <head>. */
/* English only. The channel declares <language>en-SG</language>, and an article
   published in a public feed is not an unlisted article. */
const feedItems = PRERENDER_ROUTES.filter(
  (r) => ALL_ROUTE_META[r]?.ogType === 'article' && (ALL_ROUTE_META[r]?.lang || 'en') === 'en',
)
  .map((r) => {
    const meta = ALL_ROUTE_META[r];
    const article = (meta.schema() || []).find((s) => s['@type'] === 'Article') || {};
    return {
      path: r,
      title: article.headline || meta.title,
      description: meta.description || '',
      date: article.datePublished || meta.lastmod,
      tags: String(article.keywords || '').split(',').map((t) => t.trim()).filter(Boolean),
    };
  })
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  .slice(0, 20);

const feedUpdated = feedItems[0] ? rssDate(feedItems[0].date) : new Date().toUTCString();
const rss =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n' +
  `  <title>${xmlEsc(`The Hive | ${SITE_NAME}`)}</title>\n` +
  `  <link>${BASE_URL}/hive</link>\n` +
  `  <description>${xmlEsc('What we learn running co-living in Singapore: the numbers, the rules, the operations and what things actually cost.')}</description>\n` +
  '  <language>en-SG</language>\n' +
  `  <lastBuildDate>${feedUpdated}</lastBuildDate>\n` +
  `  <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />\n` +
  feedItems
    .map(
      (a) =>
        '  <item>\n' +
        `    <title>${xmlEsc(a.title)}</title>\n` +
        `    <link>${BASE_URL}${a.path}</link>\n` +
        `    <guid isPermaLink="true">${BASE_URL}${a.path}</guid>\n` +
        `    <pubDate>${rssDate(a.date)}</pubDate>\n` +
        a.tags.map((t) => `    <category>${xmlEsc(t)}</category>\n`).join('') +
        `    <description>${xmlEsc(a.description)}</description>\n` +
        '  </item>',
    )
    .join('\n') +
  '\n</channel>\n</rss>\n';
writeFileSync(join(DIST, 'feed.xml'), rss);

/* A per-language index of the archive, for the other Lazybee surfaces to read.
   book.lazybee.sg shows three articles above its footer and used to carry its own
   hardcoded copies of them, written before this archive existed. They were never
   updated, and all three pointed at slugs that were never published, so every card
   on that page led to the generic home page.

   Built from ALL_ROUTE_META like the sitemap and the feed, so it cannot name an
   article the site does not render. Grouped by language rather than filtered to
   English like feed.xml above, because the consumer has to show a reader the
   language they are already reading in. Unlike the feed this includes the hidden
   languages: it is not a public feed, it is a list for our own surfaces, and a
   Burmese reader arriving on one is the entire point of those translations. */
const articlesByLang = {};
for (const r of PRERENDER_ROUTES) {
  const meta = ALL_ROUTE_META[r];
  if (meta?.ogType !== 'article') continue;
  const article = (meta.schema() || []).find((s) => s['@type'] === 'Article') || {};
  const lang = meta.lang || 'en';
  (articlesByLang[lang] ||= []).push({
    path: r,
    url: `${BASE_URL}${r}`,
    lang,
    title: article.headline || meta.title,
    excerpt: meta.description || '',
    date: article.datePublished || meta.lastmod || today,
    tags: String(article.keywords || '').split(',').map((t) => t.trim()).filter(Boolean),
  });
}
for (const list of Object.values(articlesByLang)) {
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
mkdirSync(join(DIST, 'hive'), { recursive: true });
writeFileSync(
  join(DIST, 'hive', 'articles.json'),
  `${JSON.stringify({ generated: today, base: BASE_URL, languages: articlesByLang }, null, 2)}\n`,
);

const pad = (s, n) => String(s).padEnd(n);
console.log('\nprerender');
console.log(`  ${pad('route', 20)}${pad('words', 8)}${pad('h1', 4)}${pad('links', 7)}${pad('json-ld', 9)}canonical`);
for (const r of results) {
  console.log(`  ${pad(r.route, 20)}${pad(r.words, 8)}${pad(r.h1, 4)}${pad(r.links, 7)}${pad(r.jsonLdBlocks, 9)}${r.canonical}`);
}
console.log(`\n  react-helmet-async emitted tags server-side: ${helmetWorked ? 'yes' : 'no'}`);
console.log(`  dist/app.html written as the noindex shell for /portal/* and unlisted routes`);
const byLang = {};
for (const r of PRERENDER_ROUTES) {
  const l = ALL_ROUTE_META[r]?.lang || 'en';
  byLang[l] = (byLang[l] || 0) + 1;
}
const langSummary = Object.entries(byLang).map(([l, n]) => `${l}:${n}`).join(' ');
console.log(`  dist/sitemap.xml regenerated with ${PRERENDER_ROUTES.length} urls (${langSummary})`);
console.log(`  dist/feed.xml written with ${feedItems.length} items`);
console.log(
  `  dist/hive/articles.json written (${Object.entries(articlesByLang)
    .map(([l, a]) => `${l}:${a.length}`)
    .join(' ')})\n`,
);

if (failures.length) {
  console.error('prerender failed:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
