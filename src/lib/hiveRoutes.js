// src/lib/hiveRoutes.js
//
// The Hive's route table and the <head> for every route in it.
//
// This is data, not JSX, for the same reason src/lib/siteMeta.js is on the
// prerender branch: the metadata has to end up in bytes that a crawler which does
// not run JavaScript can read. The prerender step on feat/seo-prerender can
// enumerate the Hive without knowing anything about markdown:
//
//   import { HIVE_ROUTES, HIVE_ROUTE_META } from './lib/hiveRoutes.js';
//
// HIVE_ROUTES is an array of paths. HIVE_ROUTE_META maps each path to
// { title, description, canonical, ogImage, ogType, schema() }, matching the
// shape ROUTE_META already uses there.

import { ARCHIVE, PAGE_COUNT } from './hiveContent.js';
import { pageOf, relatedTo } from './hiveArticles.js';
import { markdownToText } from './markdown.js';
import { breadcrumbSchema } from './seo.js';

export const BASE_URL = 'https://www.lazybee.sg';
export const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.png`;

/* Renamed from "The Hive" on 10 Aug 2026. It was our internal name for the
   archive and told a reader nothing, the same reason the nav item became Blog.
   The /hive URL is unchanged, so no redirect and no lost link equity. */
export const HIVE_TITLE = 'The Lazybee blog';
export const HIVE_BLURB =
  'Everything we pick up running nineteen rooms across three Singapore homes, written down. ' +
  'What a unit actually earns once the void is counted, what the rules mean on a Tuesday rather ' +
  'than in a circular, what breaks in year two and what it costs. No lead magnets and no gated PDFs.';

export const hiveUrl = (path) => `${BASE_URL}${path}`;

const absolute = (src) => (src && src.startsWith('/') ? `${BASE_URL}${src}` : src || DEFAULT_OG_IMAGE);

/** A description that is never empty and never longer than a search snippet. */
export function describe(article) {
  const text = article.excerpt || markdownToText(article.body);
  return text.length > 300 ? `${text.slice(0, 297).trimEnd()}...` : text;
}

/* ── structured data ──────────────────────────────────────────────── */

export function articleSchema(article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: describe(article),
    datePublished: article.date,
    dateModified: article.date,
    image: absolute(article.hero),
    keywords: article.tags.join(', '),
    wordCount: markdownToText(article.body).split(/\s+/).filter(Boolean).length,
    inLanguage: 'en-SG',
    author: { '@type': 'Person', name: article.author },
    publisher: {
      '@type': 'Organization',
      name: 'Lazybee',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/lazybee-logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': hiveUrl(article.path) },
    isPartOf: { '@type': 'Blog', name: HIVE_TITLE, url: hiveUrl('/hive') },
  };
}

export function listSchema(name, description, path, articles) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: hiveUrl(path),
    isPartOf: { '@type': 'Blog', name: HIVE_TITLE, url: hiveUrl('/hive') },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: articles.length,
      itemListElement: articles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: hiveUrl(a.path),
        name: a.title,
      })),
    },
  };
}

/* ── the head, per route ──────────────────────────────────────────── */

/* Sitemap lastmod. The prerender used to stamp the build date on every URL,
   which told Google that all eighteen pages changed on every deploy and taught
   it to discount the signal entirely. These carry the real dates instead. */
export function newestDate(articles) {
  return articles.map((a) => a.date).filter(Boolean).sort().pop() || null;
}

/** /hive and /hive/page/N. */
export function indexMeta(page = 1) {
  const path = page > 1 ? `/hive/page/${page}` : '/hive';
  const items = pageOf(ARCHIVE.articles, page);
  const suffix = page > 1 ? `, page ${page}` : '';
  return {
    title: `${HIVE_TITLE}${suffix} | Lazybee`,
    description:
      page > 1
        ? `Page ${page} of the Lazybee journal. What we learn running co-living in Singapore: the numbers, the rules, the operations and what things actually cost.`
        : HIVE_BLURB,
    canonical: hiveUrl(path),
    lastmod: newestDate(items),
    ogImage: absolute(items[0]?.hero),
    ogType: 'website',
    prev: page === 2 ? hiveUrl('/hive') : page > 2 ? hiveUrl(`/hive/page/${page - 1}`) : null,
    next: page < PAGE_COUNT ? hiveUrl(`/hive/page/${page + 1}`) : null,
    schema: [
      listSchema(`${HIVE_TITLE}${suffix}`, HIVE_BLURB, path, items),
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: HIVE_TITLE, path: '/hive' }]),
    ],
  };
}

/** /hive/topic/:tag. */
export function topicMeta(topic) {
  const path = `/hive/topic/${topic.slug}`;
  const description =
    `Everything we have written about ${topic.label.toLowerCase()} while running co-living in Singapore. ` +
    `${topic.articles.length} ${topic.articles.length === 1 ? 'piece' : 'pieces'} on the blog, all of it from our own operation.`;
  return {
    title: `${topic.label} | ${HIVE_TITLE} | Lazybee`,
    description,
    canonical: hiveUrl(path),
    lastmod: newestDate(topic.articles),
    ogImage: absolute(topic.articles[0]?.hero),
    ogType: 'website',
    schema: [
      listSchema(`${topic.label} in ${HIVE_TITLE}`, description, path, topic.articles),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: HIVE_TITLE, path: '/hive' },
        { name: topic.label, path },
      ]),
    ],
  };
}

/** /hive/:slug. */
export function articleMeta(article) {
  return {
    title: `${article.title} | ${HIVE_TITLE} | Lazybee`,
    description: describe(article),
    canonical: hiveUrl(article.path),
    lastmod: article.updated || article.date,
    ogImage: absolute(article.hero),
    ogType: 'article',
    schema: [
      articleSchema(article),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: HIVE_TITLE, path: '/hive' },
        { name: article.title, path: article.path },
      ]),
    ],
  };
}

/* ── the table the prerender step reads ───────────────────────────── */

/** Every Hive URL, in crawl order. */
export const HIVE_ROUTES = [
  '/hive',
  ...Array.from({ length: Math.max(0, PAGE_COUNT - 1) }, (_, i) => `/hive/page/${i + 2}`),
  ...ARCHIVE.topics.map((t) => `/hive/topic/${t.slug}`),
  ...ARCHIVE.articles.map((a) => a.path),
];

/**
 * path to metadata, with schema() as a function so it matches the ROUTE_META
 * contract the prerender script already calls.
 */
export const HIVE_ROUTE_META = Object.fromEntries(
  HIVE_ROUTES.map((path) => {
    let meta;
    if (path === '/hive') meta = indexMeta(1);
    else if (path.startsWith('/hive/page/')) meta = indexMeta(Number(path.split('/').pop()));
    else if (path.startsWith('/hive/topic/')) {
      meta = topicMeta(ARCHIVE.topics.find((t) => t.slug === path.split('/').pop()));
    } else {
      meta = articleMeta(ARCHIVE.articles.find((a) => a.path === path));
    }
    const { schema, ...rest } = meta;
    return [path, { ...rest, schema: () => schema }];
  }),
);

/** Related reading, re-exported so a page component has one import for the Hive. */
export { relatedTo };
