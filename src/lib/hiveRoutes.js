// src/lib/hiveRoutes.js
//
// The Hive's route table and the <head> for every route in it.
//
// This is data, not JSX, because the metadata has to end up in bytes that a
// crawler which does not run JavaScript can read. scripts/prerender.mjs
// enumerates the Hive without knowing anything about markdown:
//
//   import { HIVE_ROUTES, HIVE_ROUTE_META } from './lib/hiveRoutes.js';
//
// HIVE_ROUTES is an array of paths. HIVE_ROUTE_META maps each path to
// { title, description, canonical, ogImage, ogType, lang, htmlLang, ogLocale,
//   alternates, schema() }, matching the shape ROUTE_META uses.
//
// ── alternates ───────────────────────────────────────────────────────
// Every article route carries the full reciprocal hreflang set for its cluster,
// including a self reference and an x-default pointing at English. Google
// discards a cluster that is not reciprocal, so these are derived from the
// archive rather than declared per file: a variant cannot be listed on one page
// and missing from another.
//
// This is what makes the Burmese and Bengali articles viable at all. Nothing on
// the site links to them, so hreflang against a well linked English page, plus
// a sitemap entry, is their entire route to being discovered.

import {
  ARCHIVE, PAGE_COUNT, archiveFor, HIVE_ROUTES as ROUTE_LIST, variantsFor,
} from './hiveContent.js';
import {
  pageOf, relatedTo, langMeta, langRoot, DEFAULT_LANG, LANGUAGES, VISIBLE_LANGS,
} from './hiveArticles.js';
import { markdownToText } from './markdown.js';
import { breadcrumbSchema } from './seo.js';

export const BASE_URL = 'https://www.lazybee.sg';
export const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.png`;

/* Renamed from "The Hive" on 10 Aug 2026. It was our internal name for the
   archive and told a reader nothing, the same reason the nav item became Blog.
   The /hive URL is unchanged, so no redirect and no lost link equity. */
export const HIVE_TITLE = 'The Lazybee blog';

/* Rewritten 18 Aug 2026. The old blurb ran "what a unit earns, what the rules
   mean, what breaks in year two" and closed on "no lead magnets and no gated
   PDFs". Three-part lists and a flourish to finish are the house style of every
   AI-written landing page on the internet, which is the opposite of the point
   here: the whole claim is that a person who runs the houses wrote this. Say
   the plain thing. */
export const HIVE_BLURB =
  'What we have learned running co-living in Singapore over the past three years.';

/* The meta description is a separate string from the on-page blurb on purpose.
   The blurb wants to be one short line under a headline; a search snippet gets
   cut off around 155 characters and wants every one of them working. Same
   claim, different job. */
export const HIVE_DESCRIPTION =
  'What we have learned running co-living in Singapore over the past three years. ' +
  'Nineteen rooms across three houses, and what each one actually costs to run.';

/* Per language masthead copy. Only the visible languages need it: a hidden
   language has no index page to put it on. Written rather than machine
   translated, because it is the first thing a Mandarin reader sees. */
export const HIVE_COPY = {
  en: {
    title: HIVE_TITLE, blurb: HIVE_BLURB, description: HIVE_DESCRIPTION,
    kicker: 'Notes from the houses',
  },
  zh: {
    title: 'Lazybee 博客',
    blurb: '这三年我们在新加坡做共居，学到的东西都写在这里。',
    description:
      '这三年我们在新加坡做共居，学到的东西都写在这里。三处房子、十九个房间：' +
      '实际能租多少钱，条例到底要求什么，东西坏了修一次要花多少。',
    kicker: '来自房子的笔记',
  },
};

export const hiveUrl = (path) => `${BASE_URL}${path}`;

const absolute = (src) => (src && src.startsWith('/') ? `${BASE_URL}${src}` : src || DEFAULT_OG_IMAGE);

const copyFor = (lang) => HIVE_COPY[lang] || HIVE_COPY[DEFAULT_LANG];

/** A description that is never empty and never longer than a search snippet. */
export function describe(article) {
  const text = article.excerpt || markdownToText(article.body);
  return text.length > 300 ? `${text.slice(0, 297).trimEnd()}...` : text;
}

/* ── hreflang ─────────────────────────────────────────────────────── */

/**
 * The reciprocal alternate set for one article, self included, plus x-default.
 *
 * x-default points at English because English is what a searcher with no
 * matching locale should land on, and because English is the only variant
 * guaranteed to exist for any given piece.
 */
export function alternatesFor(article) {
  const variants = variantsFor(article);
  const list = variants.map(({ lang, article: a }) => ({
    hreflang: langMeta(lang).hreflang,
    href: hiveUrl(a.path),
  }));
  const english = variants.find((v) => v.lang === DEFAULT_LANG);
  if (english) list.push({ hreflang: 'x-default', href: hiveUrl(english.article.path) });
  return list;
}

/** The same, for listing pages, which cluster across visible languages only. */
export function indexAlternates(page = 1) {
  const suffix = page > 1 ? `/page/${page}` : '';
  const list = VISIBLE_LANGS
    .filter((code) => archiveFor(code).articles.length)
    .map((code) => ({ hreflang: langMeta(code).hreflang, href: hiveUrl(`${langRoot(code)}${suffix}`) }));
  if (list.length > 1) list.push({ hreflang: 'x-default', href: hiveUrl(`${langRoot(DEFAULT_LANG)}${suffix}`) });
  return list.length > 1 ? list : [];
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
    inLanguage: langMeta(article.lang).schemaLang,
    author: { '@type': 'Person', name: article.author },
    publisher: {
      '@type': 'Organization',
      name: 'Lazybee',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/lazybee-logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': hiveUrl(article.path) },
    isPartOf: { '@type': 'Blog', name: copyFor(article.lang).title, url: hiveUrl(langRoot(article.lang)) },
  };
}

export function listSchema(name, description, path, articles, lang = DEFAULT_LANG) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: hiveUrl(path),
    inLanguage: langMeta(lang).schemaLang,
    isPartOf: { '@type': 'Blog', name: copyFor(lang).title, url: hiveUrl(langRoot(lang)) },
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

/** The language part of every route's head, shared by all three route kinds. */
const langBits = (lang) => ({
  lang,
  htmlLang: langMeta(lang).htmlLang,
  ogLocale: langMeta(lang).ogLocale,
});

/** /hive and /hive/page/N, and their /hive/zh equivalents. */
export function indexMeta(page = 1, lang = DEFAULT_LANG) {
  const root = langRoot(lang);
  const path = page > 1 ? `${root}/page/${page}` : root;
  const archive = archiveFor(lang);
  const items = pageOf(archive.articles, page);
  const copy = copyFor(lang);
  const suffix = page > 1 ? `, page ${page}` : '';
  return {
    ...langBits(lang),
    title: `${copy.title}${suffix} | Lazybee`,
    description:
      page > 1
        ? `Page ${page} of what we have learned running co-living in Singapore.`
        : (copy.description || copy.blurb),
    canonical: hiveUrl(path),
    lastmod: newestDate(items),
    ogImage: absolute(items[0]?.hero),
    ogType: 'website',
    alternates: indexAlternates(page),
    prev: page === 2 ? hiveUrl(root) : page > 2 ? hiveUrl(`${root}/page/${page - 1}`) : null,
    next: page < archive.pageCount ? hiveUrl(`${root}/page/${page + 1}`) : null,
    schema: [
      listSchema(`${copy.title}${suffix}`, copy.description || copy.blurb, path, items, lang),
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: copy.title, path: root }]),
    ],
  };
}

/** /hive/topic/:tag. English only for now, see buildArchive. */
export function topicMeta(topic, lang = DEFAULT_LANG) {
  const path = `${langRoot(lang)}/topic/${topic.slug}`;
  const description =
    `Everything we have written about ${topic.label.toLowerCase()} while running co-living in Singapore. ` +
    `${topic.articles.length} ${topic.articles.length === 1 ? 'piece' : 'pieces'} on the blog, all of it from our own operation.`;
  return {
    ...langBits(lang),
    title: `${topic.label} | ${copyFor(lang).title} | Lazybee`,
    description,
    canonical: hiveUrl(path),
    lastmod: newestDate(topic.articles),
    ogImage: absolute(topic.articles[0]?.hero),
    ogType: 'website',
    alternates: [],
    schema: [
      listSchema(`${topic.label} in ${copyFor(lang).title}`, description, path, topic.articles, lang),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: copyFor(lang).title, path: langRoot(lang) },
        { name: topic.label, path },
      ]),
    ],
  };
}

/** /hive/:slug, /hive/zh/:slug, /hive/my/:slug, /hive/bn/:slug. */
export function articleMeta(article) {
  const lang = article.lang;
  return {
    ...langBits(lang),
    title: `${article.title} | ${copyFor(lang).title} | Lazybee`,
    description: describe(article),
    canonical: hiveUrl(article.path),
    lastmod: article.updated || article.date,
    ogImage: absolute(article.hero),
    ogType: 'article',
    /* A hidden article is still indexable. It has to be: being found in search
       is the only reason it was written. What makes it hidden is that nothing
       links to it, which is a property of the site's markup, not of this head. */
    hidden: article.hidden,
    alternates: alternatesFor(article),
    schema: [
      articleSchema(article),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: copyFor(lang).title, path: langRoot(lang) },
        { name: article.title, path: article.path },
      ]),
    ],
  };
}

/* ── the table the prerender step reads ───────────────────────────── */

/** Every Hive URL, in crawl order, every language, hidden ones included. */
export const HIVE_ROUTES = ROUTE_LIST;

/**
 * Take a Hive path apart into { lang, kind, ... }.
 *
 * Language first, because '/hive/zh/foo' and '/hive/foo' differ only by a
 * segment that is itself a legal article slug shape. The language segment is
 * matched against the closed LANGUAGES set rather than any-two-letters, so an
 * English article slugged "id" or "it" is still an article.
 */
export function parseHivePath(path) {
  const rest = path.replace(/^\/hive\/?/, '');
  const parts = rest ? rest.split('/') : [];
  let lang = DEFAULT_LANG;
  if (parts.length && LANGUAGES[parts[0]] && parts[0] !== DEFAULT_LANG) lang = parts.shift();

  if (!parts.length) return { lang, kind: 'index', page: 1 };
  if (parts[0] === 'page') return { lang, kind: 'index', page: Number(parts[1]) || 1 };
  if (parts[0] === 'topic') return { lang, kind: 'topic', slug: parts[1] };
  return { lang, kind: 'article', slug: parts[0] };
}

/**
 * path to metadata, with schema() as a function so it matches the ROUTE_META
 * contract the prerender script already calls.
 */
export const HIVE_ROUTE_META = Object.fromEntries(
  HIVE_ROUTES.map((path) => {
    const at = parseHivePath(path);
    let meta;
    if (at.kind === 'index') meta = indexMeta(at.page, at.lang);
    else if (at.kind === 'topic') {
      meta = topicMeta(archiveFor(at.lang).topics.find((t) => t.slug === at.slug), at.lang);
    } else {
      meta = articleMeta(archiveFor(at.lang).articles.find((a) => a.slug === at.slug));
    }
    const { schema, ...rest } = meta;
    return [path, { ...rest, schema: () => schema }];
  }),
);

/** Related reading, re-exported so a page component has one import for the Hive. */
export { relatedTo, PAGE_COUNT, ARCHIVE };
