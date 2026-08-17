// src/lib/hiveContent.js
//
// The Hive's content source: markdown files on disk, read at build time.
//
// ── How to add an article ────────────────────────────────────────────
// Drop a .md file into the directory for its language:
//
//   src/content/hive/en/   English    ->  /hive/<slug>
//   src/content/hive/zh/   Mandarin   ->  /hive/zh/<slug>
//   src/content/hive/my/   Burmese    ->  /hive/my/<slug>
//   src/content/hive/bn/   Bengali    ->  /hive/bn/<slug>
//
// That is the whole procedure. The directory is the language, the filename is
// the URL, the frontmatter is the metadata. No import to add, no index to
// update, no CMS, no deploy hook.
//
//   ---
//   title: What a room actually costs to run
//   date: 2026-08-04              # ISO. Sorts the archive, newest first.
//   excerpt: One or two sentences. Used on cards and as the meta description.
//   tags: [Numbers, Operations]   # Each tag becomes a hub at /hive/topic/<tag>
//   author: Mark Wee
//   hero: /photos/cp/MBR.jpg      # Optional. A path under public/.
//   heroAlt: The master room at Chiltern Park
//   ---
//
//   Body in markdown from here down.
//
// Optional frontmatter: `slug:` overrides the filename if the URL needs to
// differ from it, and `translationKey:` overrides which piece this is a
// translation of when a translated file cannot share its original filename.
//
// ── Translations ─────────────────────────────────────────────────────
// Same filename, different language directory. en/bukit-timah.md and
// my/bukit-timah.md are understood to be the same piece of writing, so they
// hreflang to each other automatically. Nothing to declare.
//
// ── Burmese and Bengali are unlisted ─────────────────────────────────
// They are prerendered, in the sitemap, indexable and hreflang linked, but no
// listing, hub, feed, related block or nav on this site points at them. See the
// header of hiveArticles.js for why that is an orphan page rather than
// cloaking, and what it costs.
//
// ── Why import.meta.glob ─────────────────────────────────────────────
// eager + query:'?raw' inlines every file into the bundle at build time, so the
// archive is present in the first paint with no fetch, no loading state and no
// runtime failure mode. There is no CMS here on purpose: Sanity is retired at
// this company and is not coming back.

import {
  buildArchive, hiveRoutes, pageOf, relatedTo, neighboursOf, variantsOf,
  DEFAULT_LANG, LANGUAGES, LANG_CODES, VISIBLE_LANGS, HIDDEN_LANGS, langRoot,
} from './hiveArticles.js';

/* One level deep, so the language directory is part of the match. */
const files = import.meta.glob('../content/hive/*/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** Every language's archive, the translation clusters, and the flat list. */
export const ARCHIVE = buildArchive(files);

/** The English archive, which is what every unqualified export here means. */
export const ARTICLES = ARCHIVE.byLang[DEFAULT_LANG].articles;
export const TOPICS = ARCHIVE.byLang[DEFAULT_LANG].topics;
export const PAGE_COUNT = ARCHIVE.byLang[DEFAULT_LANG].pageCount;

/** Every article in every language, hidden ones included. */
export const ALL_ARTICLES = ARCHIVE.all;

/** One language's archive: { lang, articles, topics, pageCount }. */
export const archiveFor = (lang) => ARCHIVE.byLang[lang] || ARCHIVE.byLang[DEFAULT_LANG];

/** Every Hive URL that exists. Exported for the sitemap and for prerendering. */
export const HIVE_ROUTES = hiveRoutes(ARCHIVE);

/**
 * An article by slug within one language. Scoped by language on purpose: two
 * languages can and should share a slug, and /hive/foo must never resolve to
 * the Burmese foo just because it happened to sort first.
 */
export const articleBySlug = (slug, lang = DEFAULT_LANG) =>
  archiveFor(lang).articles.find((a) => a.slug === slug) || null;

export const topicBySlug = (slug, lang = DEFAULT_LANG) =>
  archiveFor(lang).topics.find((t) => t.slug === slug) || null;

/** Every language variant of one article, self included, for hreflang. */
export const variantsFor = (article) => variantsOf(article, ARCHIVE);

export {
  pageOf, relatedTo, neighboursOf,
  DEFAULT_LANG, LANGUAGES, LANG_CODES, VISIBLE_LANGS, HIDDEN_LANGS, langRoot,
};
