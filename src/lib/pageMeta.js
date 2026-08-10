// src/lib/pageMeta.js
//
// Per-route <head> metadata, written straight into the DOM.
//
// Why not react-helmet-async, which this app already has installed: on React 19
// it renders without error and emits nothing. A production build of this site has
// zero [data-rh] elements in the document, so every route was shipping the shell's
// homepage title, description and canonical. A silent failure in the one layer
// whose entire job is to be read by machines is the worst possible place for one.
//
// This module cannot fail that way, because it is imperative and observable: after
// a route renders, document.title is the route's title and
// document.querySelectorAll('[data-pagemeta]') returns the tags. Both are checkable
// in the browser and in a test without any framework knowledge.
//
// It restores what it replaced. The shell in index.html declares a title, a
// description, og:*, twitter:* and a canonical; a client-side navigation away from
// a Hive route puts every one of those back exactly as it was, so no route can
// leak its identity into the next one.
//
// This is a client-side mechanism, so it fixes what a JavaScript-executing crawler
// sees. Crawlers that do not execute JavaScript are served by the prerender step
// on feat/seo-prerender, which reads the same meta objects. That is why the meta
// for every Hive route is built by pure functions in hiveRoutes.js rather than
// assembled inline in a component.

import { useEffect } from 'react';

const NAMED = ['description', 'robots', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
const PROPS = ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'og:image'];

/**
 * Apply one route's metadata to the document.
 *
 * @param {object} meta
 * @returns {() => void} a function that puts the document back as it was
 */
export function applyPageMeta(meta) {
  if (typeof document === 'undefined') return () => {};

  const head = document.head;
  const undo = [];

  const previousTitle = document.title;
  if (meta.title) document.title = meta.title;
  undo.push(() => { document.title = previousTitle; });

  /** Set one attribute on an existing tag, or create the tag if it is missing. */
  const put = (selector, create, attr, value) => {
    if (value === undefined || value === null || value === '') return;
    let el = head.querySelector(selector);
    if (el) {
      const before = el.getAttribute(attr);
      el.setAttribute(attr, value);
      undo.push(() => {
        if (before === null) el.removeAttribute(attr);
        else el.setAttribute(attr, before);
      });
      return;
    }
    el = create();
    el.setAttribute('data-pagemeta', '1');
    el.setAttribute(attr, value);
    head.appendChild(el);
    undo.push(() => el.remove());
  };

  const metaTag = (key, kind) => () => {
    const el = document.createElement('meta');
    el.setAttribute(kind, key);
    return el;
  };
  const linkTag = (rel) => () => {
    const el = document.createElement('link');
    el.setAttribute('rel', rel);
    return el;
  };

  const values = {
    description: meta.description,
    robots: meta.robots,
    'twitter:card': 'summary_large_image',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.ogImage,
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': meta.canonical,
    'og:type': meta.ogType || 'website',
    'og:site_name': 'Lazybee',
    'og:image': meta.ogImage,
  };

  for (const k of NAMED) put(`meta[name="${k}"]`, metaTag(k, 'name'), 'content', values[k]);
  for (const k of PROPS) put(`meta[property="${k}"]`, metaTag(k, 'property'), 'content', values[k]);

  put('link[rel="canonical"]', linkTag('canonical'), 'href', meta.canonical);

  /* prev and next are per-page by definition, so any pair left over from the
     previous route is removed rather than reused. Otherwise page 3's "next"
     would survive onto an article that has no pagination at all. */
  for (const rel of ['prev', 'next']) {
    head.querySelectorAll(`link[rel="${rel}"]`).forEach((el) => {
      const parent = el.parentNode;
      const sibling = el.nextSibling;
      el.remove();
      undo.push(() => parent.insertBefore(el, sibling));
    });
    const href = rel === 'prev' ? meta.prev : meta.next;
    if (href) {
      const el = document.createElement('link');
      el.setAttribute('rel', rel);
      el.setAttribute('href', href);
      el.setAttribute('data-pagemeta', '1');
      head.appendChild(el);
      undo.push(() => el.remove());
    }
  }

  /* Structured data is always added rather than patched: the shell ships an
     Organization block that stays, and this route's Article or CollectionPage
     block sits alongside it and leaves with the route. */
  for (const schema of meta.schema || []) {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-pagemeta', 'schema');
    el.textContent = JSON.stringify(schema);
    head.appendChild(el);
    undo.push(() => el.remove());
  }

  return () => { while (undo.length) undo.pop()(); };
}

/**
 * Apply metadata for as long as the component is mounted.
 *
 * The dependency is the serialised meta rather than the object, because a route
 * component rebuilds its meta object on every render and an object identity
 * dependency would tear the head down and rebuild it each time.
 */
export function usePageMeta(meta) {
  const key = JSON.stringify(meta);
  useEffect(() => applyPageMeta(JSON.parse(key)), [key]);
}
