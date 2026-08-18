// src/pages/hive/HiveTopicPage.jsx
//
// /hive/topic/:tag, and /hive/zh/topic/:tag.
//
// The hub slug is the English tag in every language, so these two are the same
// subject in two languages and hreflang to each other. Only the chip label and
// the surrounding copy are translated. Unlisted languages get no hub at all:
// a hub is a listing page, which is the one thing an unlisted language must
// not have.
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

import { archiveFor, topicBySlug, DEFAULT_LANG, langRoot } from '../../lib/hiveContent';
import { topicMeta, HIVE_COPY } from '../../lib/hiveRoutes';
import { usePageMeta } from '../../lib/pageMeta';
import { useReveal } from '../../hooks/useReveal';
import { useScrollTop } from '../../hooks/useScrollTop';
import {
  HiveHeader, HiveFooter, HiveBanner, TopicChips, LeadCard, ArticleCard,
} from '../../components/hive/HiveChrome';

import '../../styles/lazybee.css';

export default function HiveTopicPage({ lang = DEFAULT_LANG }) {
  const { tag } = useParams();
  const topic = topicBySlug(tag, lang);
  const copy = HIVE_COPY[lang] || HIVE_COPY[DEFAULT_LANG];
  const root = langRoot(lang);

  const rootRef = useRef(null);
  useReveal(rootRef, tag);
  useScrollTop(tag);

  usePageMeta(topic ? topicMeta(topic, lang) : { title: `${copy.title} | Lazybee`, robots: 'noindex,follow' });

  if (!topic) return <Navigate to={root} replace />;

  const [lead, ...rest] = topic.articles;

  return (
    <LazybeeRoot className="lzb hive" ref={rootRef}>
      <HiveHeader lang={lang} />

      <HiveBanner
        kicker={<>{copy.kicker} · <Link to={root} className="bannerlink">{copy.allSubjects}</Link></>}
        title={topic.label}
        blurb={copy.topicBlurb(topic.label)}
        count={topic.articles.length}
        lang={lang}
      />

      <main className="wrap hivemain" id="top">
        {lead && <LeadCard article={lead} kicker={copy.mostRecent} />}

        <TopicChips topics={archiveFor(lang).topics} activeSlug={topic.slug} lang={lang} />

        {rest.length > 0 && (
          <div className="list">
            {rest.map((a) => <ArticleCard key={a.slug} article={a} />)}
          </div>
        )}

        <p className="small backline">
          <Link to={root}>{copy.backToAll}</Link>
        </p>
      </main>

      <HiveFooter />
    </LazybeeRoot>
  );
}
