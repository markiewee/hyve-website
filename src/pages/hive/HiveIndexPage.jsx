// src/pages/hive/HiveIndexPage.jsx
//
// /hive and /hive/page/:page.
//
// The archive rule: the most recent PAGE_SIZE articles are here, and every older
// one is reachable from here by following an <a href>, either through the numbered
// pages or through a subject hub. No load-more button, no infinite scroll. A page
// that only exists after a click is a page that Google and the AI crawlers never
// see, which would defeat the point of writing any of it.

import { useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { ARCHIVE, PAGE_COUNT, pageOf } from '../../lib/hiveContent';
import { indexMeta, HIVE_TITLE, HIVE_BLURB } from '../../lib/hiveRoutes';
import { usePageMeta } from '../../lib/pageMeta';
import { useReveal } from '../../hooks/useReveal';
import { useScrollTop } from '../../hooks/useScrollTop';
import { useLazybeeTheme } from '../../hooks/useLazybeeTheme';
import {
  HiveHeader, HiveFooter, HiveBanner, TopicChips, LeadCard, ArticleCard, Pagination,
} from '../../components/hive/HiveChrome';

import '../../styles/lazybee.css';

/* A page number is valid when it is a plain positive integer inside the range.
   "2x", "-1" and "007" are all rejected rather than coerced, so there is exactly
   one URL per page and no duplicate content under a second spelling of it. */
const parsePage = (raw) => (raw === undefined ? 1 : /^[1-9]\d*$/.test(raw) ? Number(raw) : 0);

export default function HiveIndexPage() {
  const { page: rawPage } = useParams();
  const page = parsePage(rawPage);
  const valid = page >= 1 && page <= PAGE_COUNT && rawPage !== '1';

  const [theme, toggleTheme] = useLazybeeTheme();
  const rootRef = useRef(null);
  useReveal(rootRef, page);
  useScrollTop(page);

  /* The head is applied on every render, including the one that redirects, so the
     hook order never changes between renders. An out of range page is marked
     noindex: it renders a redirect, and an empty page that returns 200 is a soft
     404, which search engines will happily index. */
  usePageMeta(valid ? indexMeta(page) : { title: `${HIVE_TITLE} | Lazybee`, robots: 'noindex,follow' });

  if (!valid) return <Navigate to="/hive" replace />;

  const items = pageOf(ARCHIVE.articles, page);
  const lead = page === 1 ? items[0] : null;
  const rest = page === 1 ? items.slice(1) : items;

  return (
    <div className="lzb hive" data-theme={theme} ref={rootRef}>
      <HiveHeader theme={theme} onToggleTheme={toggleTheme} />

      <HiveBanner
        kicker={page > 1 ? `The Lazybee journal · page ${page} of ${PAGE_COUNT}` : 'The Lazybee journal'}
        title={HIVE_TITLE}
        blurb={page > 1 ? null : HIVE_BLURB}
        count={ARCHIVE.articles.length}
        subjects={ARCHIVE.topics.length}
      />

      <main className="wrap hivemain" id="top">
        {lead && <LeadCard article={lead} kicker="Latest" />}

        <TopicChips topics={ARCHIVE.topics} activeSlug={null} />

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

        <Pagination page={page} pageCount={PAGE_COUNT} />
      </main>

      <HiveFooter />
    </div>
  );
}
