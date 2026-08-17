// src/lib/hiveArticles.js
//
// The Hive, pure. Everything here is plain data in, plain data out: no React, no
// Vite, no DOM. That is deliberate. Three different callers need the same answers
// and none of them should be able to disagree with the others.
//
//   1. src/lib/hiveContent.js  loads the markdown through import.meta.glob and
//                              hands the raw strings here (browser build).
//   2. scripts/prerender.mjs   imports countWords from here directly, in Node,
//                              which is why this file stays dependency free.
//   3. src/lib/hiveArticles.test.js  feeds it fixtures.
//
// If the sitemap and the site ever disagreed about which URLs exist, the archive
// would be half invisible, which is the exact failure this whole feature is meant
// to avoid. One parser, one sort, one route builder, three callers.
//
// ── Four languages, two of them unlisted ─────────────────────────────
// English and Mandarin are audience facing: the site's EN / 中文 control moves a
// reader between them, and each has its own index listing only its own articles.
// Burmese and Bengali are search acquisition only. They are real pages at real
// URLs serving identical bytes to every requester, they are in the sitemap, and
// they are bound to their English counterpart by hreflang, but nothing on the
// site links to them, so no amount of clicking around lazybee.sg surfaces one.
//
// That is an orphan page, not cloaking. Cloaking means showing Googlebot
// something different from what a human gets at the same URL, and it is a policy
// violation that gets sites deindexed. Nothing here varies by user agent.
//
// The cost of an orphan page is real: no internal link equity, and discovery
// only through the sitemap. Two things offset it, and both are load bearing
// rather than decorative. hreflang ties each hidden page to an English page that
// does have inbound links, and hidden articles link to each other within their
// own language, so each hidden set is a connected island instead of N pages with
// no inbound links at all.

/** How many articles show on /hive and on each /hive/page/N. */
export const PAGE_SIZE = 50;

/** Reading speed used for the "N min read" stamp. Ordinary prose, not skimming. */
const WORDS_PER_MINUTE = 200;

/* ── languages ────────────────────────────────────────────────────── */

/**
 * Every language the archive can hold.
 *
 * `prefix` is the URL segment under /hive. English has none, so every existing
 * English URL is byte for byte what it was before this file learned about
 * languages: no redirects, no lost link equity.
 *
 * `hidden` is the whole feature. A hidden language is excluded from listings,
 * topic hubs, related reading, neighbours, the feed and the language switch. It
 * is never excluded from the sitemap or from prerendering, and it is never
 * marked noindex, because being found in search is the only reason it exists.
 */
export const LANGUAGES = {
  en: {
    code: 'en', prefix: '', hidden: false, label: 'English',
    htmlLang: 'en', hreflang: 'en', ogLocale: 'en_SG', schemaLang: 'en-SG',
  },
  zh: {
    code: 'zh', prefix: '/zh', hidden: false, label: '中文',
    htmlLang: 'zh-Hans', hreflang: 'zh-Hans', ogLocale: 'zh_CN', schemaLang: 'zh-Hans-SG',
  },
  my: {
    code: 'my', prefix: '/my', hidden: true, label: 'မြန်မာ',
    htmlLang: 'my', hreflang: 'my', ogLocale: 'my_MM', schemaLang: 'my-MM',
  },
  bn: {
    code: 'bn', prefix: '/bn', hidden: true, label: 'বাংলা',
    htmlLang: 'bn', hreflang: 'bn', ogLocale: 'bn_BD', schemaLang: 'bn-BD',
  },
};

export const DEFAULT_LANG = 'en';
export const LANG_CODES = Object.keys(LANGUAGES);
export const VISIBLE_LANGS = LANG_CODES.filter((c) => !LANGUAGES[c].hidden);
export const HIDDEN_LANGS = LANG_CODES.filter((c) => LANGUAGES[c].hidden);

/**
 * Slugs an English article may not use, because each already names a route under
 * /hive. An article at /hive/zh would shadow the Mandarin index, and React
 * Router resolves a static segment ahead of a dynamic one, so the article would
 * simply never render. buildArchive throws rather than let that ship.
 */
export const RESERVED_SLUGS = new Set(['zh', 'my', 'bn', 'page', 'topic']);

export const langMeta = (code) => LANGUAGES[code] || LANGUAGES[DEFAULT_LANG];

/** '/hive', '/hive/zh', '/hive/my'. The root of one language's archive. */
export const langRoot = (code) => `/hive${langMeta(code).prefix}`;

/** Where an article lives: '/hive/foo', '/hive/zh/foo'. */
export const articlePath = (code, slug) => `${langRoot(code)}/${slug}`;

/**
 * Which language a file belongs to, read from its parent directory:
 * src/content/hive/my/foo.md is Burmese. A file that is not inside a language
 * directory is English, so a stray file at the old flat path still renders
 * rather than silently dropping out of the archive.
 */
export function langFromPath(path) {
  const parts = String(path).split('/').filter(Boolean);
  const dir = parts[parts.length - 2];
  return LANGUAGES[dir] ? dir : DEFAULT_LANG;
}

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

/* ── slugs, tags, dates, length ───────────────────────────────────── */

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

/* Two of the four languages here do not put spaces between words, so splitting
   on whitespace counts a whole article as a couple of dozen "words". That reads
   as thin content to the prerender audit and fails the build, and it puts a
   nonsense reading time on the page. Each unspaced script is counted by
   character instead, at its own ratio:

     Burmese   roughly 4 characters per word, syllable-clustered and long
     Chinese   roughly 1.7 characters per word, most words being one or two hanzi

   Bengali and English space their words normally and need no special case,
   which is why Bengali is not in this list despite also being non-Latin. The
   test is on the text, not on the declared language, so a mostly-English page
   with a few Chinese characters is still counted as English. */
const UNSPACED_SCRIPTS = [
  // Myanmar, plus the Shan and Mon extensions that share its blocks
  { re: /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/g, charsPerWord: 4 },
  // CJK unified ideographs, extension A, and the compatibility block
  { re: /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, charsPerWord: 1.7 },
];

/* Below this share of the text, an unspaced script is incidental rather than the
   language of the page: a Chinese place name inside an English sentence should
   not flip the whole article onto a character count. */
const SCRIPT_DOMINANCE = 0.2;

/**
 * Words in a string, by whatever counting rule its writing system needs.
 *
 * Exported because the prerender audit has to apply the same rule to the
 * rendered HTML that this file applies to the markdown. If the two disagreed, a
 * Burmese article would pass one check and fail the other.
 */
export function countWords(text) {
  const s = String(text).trim();
  if (!s) return 0;
  const dense = s.replace(/\s+/g, '');
  if (dense.length) {
    for (const { re, charsPerWord } of UNSPACED_SCRIPTS) {
      const hits = (dense.match(re) || []).length;
      if (hits / dense.length >= SCRIPT_DOMINANCE) {
        return Math.max(1, Math.round(dense.length / charsPerWord));
      }
    }
  }
  return s.split(/\s+/).filter(Boolean).length;
}

/** Whole minutes, never zero, counted on the markdown body. */
export function readingMinutes(body) {
  return Math.max(1, Math.round(countWords(body) / WORDS_PER_MINUTE));
}

/* ── one article ──────────────────────────────────────────────────── */

/**
 * Turn one markdown file into an article record.
 *
 * @param {string} path  the file path. Its parent directory is the language and
 *                       its filename is both the slug and the translation key.
 * @param {string} raw   the file contents
 */
export function parseArticle(path, raw) {
  const { data, body } = parseFrontmatter(raw);
  const fileSlug = String(path).split('/').pop().replace(/\.md$/i, '');
  const lang = langFromPath(path);
  const slug = slugify(data.slug || fileSlug);
  const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [])
    .map((t) => String(t).trim())
    .filter(Boolean);

  return {
    slug,
    lang,
    hidden: langMeta(lang).hidden,
    /* What binds the language variants of one piece together for hreflang. The
       filename, so a translator drops my/foo.md beside en/foo.md and the cluster
       forms itself with nothing to declare and nothing to keep in sync.
       Overridable for the case where a translated file cannot share its name. */
    translationKey: slugify(data.translationKey || fileSlug),
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
    path: articlePath(lang, slug),
  };
}

/* ── the collection ───────────────────────────────────────────────── */

const byDateThenSlug = (a, b) =>
  (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date));

/**
 * Build the whole archive from a map of path to raw file contents.
 *
 * Newest first, within each language. Ties broken by slug so the order is stable
 * across builds, which matters because page 2 of a blog must not reshuffle
 * between deploys.
 */
export function buildArchive(files) {
  const all = Object.entries(files)
    .map(([path, raw]) => parseArticle(path, raw))
    .sort(byDateThenSlug);

  const clash = all.find((a) => a.lang === DEFAULT_LANG && RESERVED_SLUGS.has(a.slug));
  if (clash) {
    throw new Error(
      `hiveArticles: "${clash.slug}" is a reserved slug. /hive/${clash.slug} already names a ` +
        'route, so the article would never render. Rename the file or set a different slug:.',
    );
  }

  const byLang = {};
  for (const code of LANG_CODES) {
    const articles = all.filter((a) => a.lang === code);

    /* Topic hubs are English only for now. slugify() strips everything outside
       [a-z0-9], so a Chinese or Burmese tag slugifies to the empty string and
       every tag in that language would collide on one broken hub URL. Tags are
       still parsed and still ride along in the Article schema; they just do not
       mint routes until slugify handles non-Latin scripts. */
    const byTag = new Map();
    if (code === DEFAULT_LANG) {
      for (const a of articles) {
        a.tags.forEach((label, i) => {
          const s = a.tagSlugs[i];
          if (!s) return;
          if (!byTag.has(s)) byTag.set(s, { slug: s, label, articles: [] });
          byTag.get(s).articles.push(a);
        });
      }
    }
    const topics = [...byTag.values()].sort(
      (x, y) => y.articles.length - x.articles.length || x.label.localeCompare(y.label),
    );

    byLang[code] = {
      lang: code,
      articles,
      topics,
      pageCount: Math.max(1, Math.ceil(articles.length / PAGE_SIZE)),
    };
  }

  /* translationKey to { en: article, my: article, ... }. One entry per piece of
     writing rather than per file, which is what an hreflang cluster is. */
  const translations = new Map();
  for (const a of all) {
    if (!translations.has(a.translationKey)) translations.set(a.translationKey, {});
    translations.get(a.translationKey)[a.lang] = a;
  }

  return {
    all,
    byLang,
    translations,
    /* The English archive spread at the top level, so every caller that predates
       four languages keeps working and keeps meaning English. */
    ...byLang[DEFAULT_LANG],
  };
}

/** One page of the index. Page 1 is /hive, page N is /hive/page/N. */
export function pageOf(articles, page, size = PAGE_SIZE) {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  return articles.slice((p - 1) * size, p * size);
}

/**
 * Every language variant of one article, in a fixed order, self included.
 *
 * Google discards a non-reciprocal hreflang cluster wholesale, so this is
 * derived from the archive on every call rather than declared per file: a
 * variant cannot appear on one page's list and be missing from another's.
 */
export function variantsOf(article, archive) {
  const group = archive.translations?.get(article.translationKey) || { [article.lang]: article };
  return LANG_CODES.filter((c) => group[c]).map((c) => ({ lang: c, article: group[c] }));
}

/**
 * Related reading for an article page: same subject first, newest of those, then
 * padded with the newest of anything else so the block is never half empty. The
 * article itself is never in its own related list.
 *
 * Scoped to the article's own language. Sending a Burmese reader to an English
 * page is bad reading, and on a hidden article it would also be the one click
 * that leaks the page back into the visible site.
 */
export function relatedTo(article, articles, limit = 3) {
  const sameLang = articles.filter((a) => a.lang === article.lang && a.slug !== article.slug);
  const shared = sameLang.filter((a) => a.tagSlugs.some((t) => article.tagSlugs.includes(t)));
  const rest = sameLang.filter((a) => !shared.includes(a));
  return [...shared, ...rest].slice(0, limit);
}

/** Newer and older article, for the previous/next pair at the foot of a post. */
export function neighboursOf(article, articles) {
  const sameLang = articles.filter((a) => a.lang === article.lang);
  const i = sameLang.findIndex((a) => a.slug === article.slug);
  return {
    newer: i > 0 ? sameLang[i - 1] : null,
    older: i >= 0 && i < sameLang.length - 1 ? sameLang[i + 1] : null,
  };
}

/* ── the route table ──────────────────────────────────────────────── */

/**
 * Every Hive URL that exists, in crawl order.
 *
 * Per visible language: the index, its numbered pages, its topic hubs, then its
 * articles. Per hidden language: the articles only, because an index would be a
 * listing and a listing is exactly what a hidden language must not have.
 *
 * The hidden articles are in this list on purpose. It is what the sitemap is
 * built from, and the sitemap is their only route to being discovered.
 */
export function hiveRoutes(archive) {
  const routes = [];
  for (const code of LANG_CODES) {
    const a = archive.byLang?.[code];
    if (!a || !a.articles.length) continue;
    if (!LANGUAGES[code].hidden) {
      routes.push(langRoot(code));
      for (let p = 2; p <= a.pageCount; p += 1) routes.push(`${langRoot(code)}/page/${p}`);
      for (const t of a.topics) routes.push(`${langRoot(code)}/topic/${t.slug}`);
    }
    for (const art of a.articles) routes.push(art.path);
  }
  return routes;
}
