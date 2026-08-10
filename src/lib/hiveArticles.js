// src/lib/hiveArticles.js
//
// The Hive, pure. Everything here is plain data in, plain data out: no React, no
// Vite, no DOM. That is deliberate. Three different callers need the same answers
// and none of them should be able to disagree with the others.
//
//   1. src/lib/hiveContent.js  loads the markdown through import.meta.glob and
//                              hands the raw strings here (browser build).
//   2. scripts/sitemap.mjs     reads the same files with node:fs and hands the
//                              raw strings here (build step).
//   3. src/lib/hiveArticles.test.js  feeds it fixtures.
//
// If the sitemap and the site ever disagreed about which URLs exist, the archive
// would be half invisible, which is the exact failure this whole feature is meant
// to avoid. One parser, one sort, one route builder, three callers.

/** How many articles show on /hive and on each /hive/page/N. */
export const PAGE_SIZE = 50;

/** Reading speed used for the "N min read" stamp. Ordinary prose, not skimming. */
const WORDS_PER_MINUTE = 200;

/* ── frontmatter ──────────────────────────────────────────────────── */

const stripQuotes = (v) => {
  const s = v.trim();
  if (s.length > 1 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    return s.slice(1, -1);
  }
  return s;
};

/**
 * A deliberately small YAML subset, covering exactly what a post needs:
 *
 *   key: value                 scalar, quotes optional
 *   key: [one, two]            inline list
 *   key:                       block list
 *     - one
 *     - two
 *   key: >                     folded block, joined with spaces
 *     line one
 *     line two
 *
 * Anything else is out of scope on purpose. A full YAML parser is a dependency
 * and an attack surface for the sake of five fields we control.
 *
 * @param {string} raw  the whole file, frontmatter fence included
 * @returns {{data: Record<string, string|string[]>, body: string}}
 */
export function parseFrontmatter(raw) {
  const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text.trim() };

  const lines = m[1].split('\n');
  const data = {};
  let key = null;
  let mode = null; // 'list' | 'block'

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indented = /^\s/.test(line);
    const listItem = line.trim().startsWith('- ');

    if (indented && mode === 'block' && key) {
      data[key] = data[key] ? `${data[key]} ${line.trim()}` : line.trim();
      continue;
    }
    if (listItem && mode === 'list' && key) {
      data[key].push(stripQuotes(line.trim().slice(2)));
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const value = kv[2].trim();

    if (value === '' ) { data[key] = []; mode = 'list'; continue; }
    if (value === '>' || value === '|') { data[key] = ''; mode = 'block'; continue; }
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s))
        .filter(Boolean);
      mode = null;
      continue;
    }
    data[key] = stripQuotes(value);
    mode = null;
  }

  // A key declared with no value and never followed by "- item" is an empty
  // string, not an empty list. Fix that up so `excerpt:` on its own is harmless.
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k]) && data[k].length === 0) data[k] = '';
  }

  return { data, body: text.slice(m[0].length).trim() };
}

/* ── slugs, tags, dates ───────────────────────────────────────────── */

/** URL-safe slug. Used for filenames, tags and heading anchors alike. */
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "2026-08-04" to "4 Aug 2026". Parsed as UTC so the day never slips by one. */
export function formatDate(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(d);
}

/** Whole minutes, never zero, counted on the markdown body. */
export function readingMinutes(body) {
  const words = String(body).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/* ── one article ──────────────────────────────────────────────────── */

/**
 * Turn one markdown file into an article record.
 *
 * @param {string} path  the file path, used to derive a slug when frontmatter omits one
 * @param {string} raw   the file contents
 */
export function parseArticle(path, raw) {
  const { data, body } = parseFrontmatter(raw);
  const fileSlug = String(path).split('/').pop().replace(/\.md$/i, '');
  const slug = slugify(data.slug || fileSlug);
  const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [])
    .map((t) => String(t).trim())
    .filter(Boolean);

  return {
    slug,
    title: String(data.title || fileSlug),
    date: String(data.date || '').slice(0, 10),
    dateLabel: formatDate(data.date || ''),
    excerpt: String(data.excerpt || ''),
    tags,
    tagSlugs: tags.map(slugify),
    author: String(data.author || 'Lazybee'),
    hero: data.hero ? String(data.hero) : null,
    heroAlt: data.heroAlt ? String(data.heroAlt) : '',
    readingMinutes: readingMinutes(body),
    body,
    path: `/hive/${slug}`,
  };
}

/* ── the collection ───────────────────────────────────────────────── */

/**
 * Build the whole archive from a map of path to raw file contents.
 *
 * Newest first. Ties broken by slug so the order is stable across builds, which
 * matters because page 2 of a blog must not reshuffle between deploys.
 */
export function buildArchive(files) {
  const articles = Object.entries(files)
    .map(([path, raw]) => parseArticle(path, raw))
    .sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));

  /* Tags keep the label the author typed, keyed by slug, counted once. First
     spelling wins, so "Operations" and "operations" do not become two hubs. */
  const byTag = new Map();
  for (const a of articles) {
    a.tags.forEach((label, i) => {
      const s = a.tagSlugs[i];
      if (!byTag.has(s)) byTag.set(s, { slug: s, label, articles: [] });
      byTag.get(s).articles.push(a);
    });
  }
  const topics = [...byTag.values()].sort((x, y) => y.articles.length - x.articles.length || x.label.localeCompare(y.label));

  return { articles, topics, pageCount: Math.max(1, Math.ceil(articles.length / PAGE_SIZE)) };
}

/** One page of the index. Page 1 is /hive, page N is /hive/page/N. */
export function pageOf(articles, page, size = PAGE_SIZE) {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  return articles.slice((p - 1) * size, p * size);
}

/**
 * Related reading for an article page: same subject first, newest of those, then
 * padded with the newest of anything else so the block is never half empty. The
 * article itself is never in its own related list.
 */
export function relatedTo(article, articles, limit = 3) {
  const others = articles.filter((a) => a.slug !== article.slug);
  const shared = others.filter((a) => a.tagSlugs.some((t) => article.tagSlugs.includes(t)));
  const rest = others.filter((a) => !shared.includes(a));
  return [...shared, ...rest].slice(0, limit);
}

/** Newer and older article, for the previous/next pair at the foot of a post. */
export function neighboursOf(article, articles) {
  const i = articles.findIndex((a) => a.slug === article.slug);
  return {
    newer: i > 0 ? articles[i - 1] : null,
    older: i >= 0 && i < articles.length - 1 ? articles[i + 1] : null,
  };
}

/* ── the route table ──────────────────────────────────────────────── */

/**
 * Every Hive URL that exists, in crawl order: the index, its numbered pages, the
 * topic hubs, then the articles.
 *
 * Exported as plain strings so the prerender work on feat/seo-prerender can
 * enumerate the Hive without knowing anything about markdown, and so
 * scripts/sitemap.mjs and the running site can never list different URLs.
 */
export function hiveRoutes(archive) {
  const routes = ['/hive'];
  for (let p = 2; p <= archive.pageCount; p += 1) routes.push(`/hive/page/${p}`);
  for (const t of archive.topics) routes.push(`/hive/topic/${t.slug}`);
  for (const a of archive.articles) routes.push(`/hive/${a.slug}`);
  return routes;
}
