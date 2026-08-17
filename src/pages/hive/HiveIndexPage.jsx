// src/pages/hive/HiveIndexPage.jsx
//
// /hive and /hive/page/:page, plus /hive/zh and /hive/zh/page/:page.
//
// The archive rule: the most recent PAGE_SIZE articles are here, and every older
// one is reachable from here by following an <a href>, either through the numbered
// pages or through a subject hub. No load-more button, no infinite scroll. A page
// that only exists after a click is a page that Google and the AI crawlers never
// see, which would defeat the point of writing any of it.
//
// One index per visible language, each listing only its own articles, rather than
// one index that filters on a language toggle. Two reasons, and the second is the
// one that decides it:
//
//   1. A prerendered page can only be in one language. A filtered index would
//      ship English HTML to every crawler and only become Chinese after
//      hydration, which is exactly the invisibility the prerender exists to fix.
//   2. A language choice that does not change the URL cannot be linked,
//      bookmarked, shared or crawled.
//
// Burmese and Bengali have no index here and never will. That is the feature.

import { LazybeeRoot } from '../../hooks/useLazybeeTheme';
import { useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { archiveFor, pageOf, DEFAULT_LANG, langRoot } from '../../lib/hiveContent';
import { indexMeta, HIVE_COPY } from '../../lib/hiveRoutes';
import { usePageMeta } from '../../lib/pageMeta';
import { useReveal } from '../../hooks/useReveal';
import { useScrollTop } from '../../hooks/useScrollTop';
import {
  HiveHeader, HiveFooter, HiveBanner, TopicChips, LeadCard, ArticleCard, Pagination,
} from '../../components/hive/HiveChrome';

import '../../styles/lazybee.css';

/* A page number is valid when it is a plain positive integer inside the range.
   "2x", "-1" and "007" are all rejected rather than coerced, so there is exactly
   one URL per page and no duplicate content under a second spelling of it. */
const parsePage = (raw) => (raw === undefined ? 1 : /^[1-9]\d*$/.test(raw) ? Number(raw) : 0);

/**
 * @param {{lang?: string}} props  the language this index belongs to, passed by
 *   the route table rather than read from a toggle, so the server and the browser
 *   can never disagree about which archive this URL shows.
 */
export default function HiveIndexPage({ lang = DEFAULT_LANG }) {
  const { page: rawPage } = useParams();
  const page = parsePage(rawPage);
  const archive = archiveFor(lang);
  const copy = HIVE_COPY[lang] || HIVE_COPY[DEFAULT_LANG];
  const root = langRoot(lang);
  const valid = page >= 1 && page <= archive.pageCount && rawPage !== '1';

  const rootRef = useRef(null);
  useReveal(rootRef, page);
  useScrollTop(page);

  /* The head is applied on every render, including the one that redirects, so the
     hook order never changes between renders. An out of range page is marked
     noindex: it renders a redirect, and an empty page that returns 200 is a soft
     404, which search engines will happily index. */
  usePageMeta(valid ? indexMeta(page, lang) : { title: `${copy.title} | Lazybee`, robots: 'noindex,follow' });

  if (!valid) return <Navigate to={root} replace />;

  const items = pageOf(archive.articles, page);
  const lead = page === 1 ? items[0] : null;
  const rest = page === 1 ? items.slice(1) : items;

  return (
    <LazybeeRoot className="lzb hive" ref={rootRef}>
      <HiveHeader lang={lang} />

      <HiveBanner
        kicker={page > 1 ? `${copy.kicker} \u00b7 page ${page} of ${archive.pageCount}` : copy.kicker}
        title={copy.title}
        blurb={page > 1 ? null : copy.blurb}
        count={archive.articles.length}
        subjects={archive.topics.length || undefined}
      />

      <main className="wrap hivemain" id="top">
        {lead && <LeadCard article={lead} kicker="Latest" />}

        {archive.topics.length > 0 && <TopicChips topics={archive.topics} activeSlug={null} lang={lang} />}

        {rest.length > 0 && (
          <div className="list">
            {rest.map((a) => <ArticleCard key={a.slug} article={a} />)}
          </div>
        )}

        {items.length === 0 && (
          <div className="empty-note">
            <div className="h3">Nothing here yet</div>
            <p className="small">We only write something up once we have actually done it.</p>
          </div>
        )}

        <Pagination page={page} pageCount={archive.pageCount} root={root} />
      </main>

      <HiveFooter />
    </LazybeeRoot>
  );
}
