// src/pages/hive/HiveTopicPage.jsx
//
// /hive/topic/:tag
//
// The topic hubs are what keep the long tail two clicks from the homepage. /hive
// carries the most recent fifty; a hub carries every article on its subject, no
// matter how old, as a plain list of links. That is the crawl path that stops
// article number two hundred from being effectively unpublished.
//
// Note what is not here: any filtering. The prototype filtered the grid in place
// with JavaScript, which left the filtered view with no URL, no title, nothing for
// a crawler and nothing to link to. It also left the featured post showing an
// article from a different tag, and left the "8 pieces" counter frozen. Both of
// those are fixed by the same decision: a subject is a page, so the lead article
// and the count are simply the lead article and count of that page.

import { LazybeeRoot } from '../../hooks/useLazybeeTheme';
import { useRef } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';

import { archiveFor, topicBySlug, DEFAULT_LANG } from '../../lib/hiveContent';
import { topicMeta, HIVE_TITLE } from '../../lib/hiveRoutes';
import { usePageMeta } from '../../lib/pageMeta';
import { useReveal } from '../../hooks/useReveal';
import { useScrollTop } from '../../hooks/useScrollTop';
import {
  HiveHeader, HiveFooter, HiveBanner, TopicChips, LeadCard, ArticleCard,
} from '../../components/hive/HiveChrome';

import '../../styles/lazybee.css';

export default function HiveTopicPage() {
  const { tag } = useParams();
  const topic = topicBySlug(tag);

  const rootRef = useRef(null);
  useReveal(rootRef, tag);
  useScrollTop(tag);

  usePageMeta(topic ? topicMeta(topic) : { title: `${HIVE_TITLE} | Lazybee`, robots: 'noindex,follow' });

  if (!topic) return <Navigate to="/hive" replace />;

  const [lead, ...rest] = topic.articles;

  return (
    <LazybeeRoot className="lzb hive" ref={rootRef}>
      <HiveHeader />

      <HiveBanner
        kicker={<>Notes from the houses · <Link to="/hive" className="bannerlink">all subjects</Link></>}
        title={topic.label}
        blurb={`Everything we have written about ${topic.label.toLowerCase()} while running nineteen rooms across three Singapore homes. Newest first, all of it, nothing held back for a mailing list.`}
        count={topic.articles.length}
      />

      <main className="wrap hivemain" id="top">
        {lead && <LeadCard article={lead} kicker="Most recent" />}

        <TopicChips topics={archiveFor(DEFAULT_LANG).topics} activeSlug={topic.slug} />

        {rest.length > 0 && (
          <div className="list">
            {rest.map((a) => <ArticleCard key={a.slug} article={a} />)}
          </div>
        )}

        <p className="small backline">
          <Link to="/hive">Back to everything on the blog</Link>
        </p>
      </main>

      <HiveFooter />
    </LazybeeRoot>
  );
}
