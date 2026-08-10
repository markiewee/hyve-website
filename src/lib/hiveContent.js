// src/lib/hiveContent.js
//
// The Hive's content source: markdown files on disk, read at build time.
//
// ── How to add an article ────────────────────────────────────────────
// Drop a .md file into src/content/hive/. That is the whole procedure. The
// filename becomes the URL (my-post.md becomes /hive/my-post), the frontmatter
// becomes the metadata, and the article appears at the top of /hive if its date
// is the newest. No import to add, no index to update, no CMS, no deploy hook.
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
// Optional frontmatter: `slug:` overrides the filename if the URL needs to differ
// from it, which is mostly useful when renaming a file without breaking a link.
//
// ── Why import.meta.glob ─────────────────────────────────────────────
// eager + query:'?raw' inlines every file into the bundle at build time, so the
// archive is present in the first paint with no fetch, no loading state and no
// runtime failure mode. There is no CMS here on purpose: Sanity is retired at
// this company and is not coming back.

import { buildArchive, hiveRoutes, pageOf, relatedTo, neighboursOf } from './hiveArticles.js';

const files = import.meta.glob('../content/hive/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** The whole archive: articles newest first, topics by size, and the page count. */
export const ARCHIVE = buildArchive(files);

export const ARTICLES = ARCHIVE.articles;
export const TOPICS = ARCHIVE.topics;
export const PAGE_COUNT = ARCHIVE.pageCount;

/** Every Hive URL that exists. Exported for the sitemap and for prerendering. */
export const HIVE_ROUTES = hiveRoutes(ARCHIVE);

export const articleBySlug = (slug) => ARTICLES.find((a) => a.slug === slug) || null;
export const topicBySlug = (slug) => TOPICS.find((t) => t.slug === slug) || null;

export { pageOf, relatedTo, neighboursOf };
