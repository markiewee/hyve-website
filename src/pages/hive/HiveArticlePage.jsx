// src/pages/hive/HiveArticlePage.jsx
//
// /hive/:slug, and the same page under /hive/zh, /hive/my and /hive/bn.
//
// Every article links out to its subjects, to the article either side of it in
// time, and to three related pieces. That is deliberate: an archive that is only
// a flat reverse-chronological list gives a crawler exactly one path in and one
// path out, and everything past the first page sits at the bottom of it. The
// cross links turn the archive into a mesh instead, which is the difference
// between the long tail being indexed and being technically present.
//
// ── The unlisted languages ───────────────────────────────────────────
// A Burmese or Bengali article renders exactly like an English one and is
// indexable exactly like an English one. What differs is the direction of its
// links. Nothing on the visible site points at it, and every link it renders
// points either within its own language or back to English. So a reader who
// arrives from a search result can get around and get into the rest of the site,
// and a reader browsing lazybee.sg has no path in.
//
// The breadcrumb and the back link deliberately do not use this language's own
// root: /hive/my is not a page and never will be. They use /hive, which also
// gives each orphan a crawl path back into the linked part of the site.

import { LazybeeRoot } from '../../hooks/useLazybeeTheme';
import { useMemo, useRef } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';

import {
  articleBySlug, ALL_ARTICLES, relatedTo, neighboursOf, variantsFor,
  DEFAULT_LANG, LANGUAGES, langRoot,
} from '../../lib/hiveContent';
import { articleMeta, HIVE_COPY } from '../../lib/hiveRoutes';
import { renderMarkdown } from '../../lib/markdown';
import { slugify } from '../../lib/hiveArticles';
import { usePageMeta } from '../../lib/pageMeta';
import { useReveal } from '../../hooks/useReveal';
import { useScrollTop } from '../../hooks/useScrollTop';
import { BOOKING_URL } from '../../lib/booking';
import { HiveHeader, HiveFooter, ArticleCard } from '../../components/hive/HiveChrome';

import '../../styles/lazybee.css';

export default function HiveArticlePage({ lang = DEFAULT_LANG }) {
  const { slug } = useParams();
  const article = articleBySlug(slug, lang);

  const rootRef = useRef(null);
  useReveal(rootRef, slug);
  useScrollTop(slug);

  const copy = HIVE_COPY[lang] || HIVE_COPY[DEFAULT_LANG];
  usePageMeta(article ? articleMeta(article) : { title: `${copy.title} | Lazybee`, robots: 'noindex,follow' });

  /* Parsing markdown is cheap, but it is pure and it runs on every theme toggle
     otherwise, and a theme toggle should not re-parse the article. */
  const rendered = useMemo(() => (article ? renderMarkdown(article.body) : null), [article]);

  const hidden = Boolean(LANGUAGES[lang]?.hidden);

  if (!article) return <Navigate to={hidden ? '/hive' : langRoot(lang)} replace />;

  /* Where "the blog" points from this page. A hidden language has no index, so
     it borrows English's. See the header note. */
  const blogRoot = hidden ? '/hive' : langRoot(lang);
  const blogLabel = hidden ? HIVE_COPY[DEFAULT_LANG].title : copy.title;

  /* Topic hubs are English only, so tags are links in English and plain labels
     everywhere else. A chip pointing at /hive/topic/x from a Chinese page would
     be a link out of the language; from a hidden page it would be a leak. */
  const tagsAreLinks = lang === DEFAULT_LANG;

  const related = relatedTo(article, ALL_ARTICLES);
  const { newer, older } = neighboursOf(article, ALL_ARTICLES);

  /* Offered on unlisted articles only, and only ever pointing outward to a
     listed language. The English article never advertises its Burmese
     translation in the page body: that link is the one thing that would put a
     hidden article back inside the site's click graph. */
  const readElsewhere = hidden
    ? variantsFor(article).filter((v) => !LANGUAGES[v.lang].hidden)
    : [];

  return (
    <LazybeeRoot className="lzb hive" ref={rootRef}>
      <HiveHeader lang={hidden ? DEFAULT_LANG : lang} />

      <main id="top">
        <article className="wrap post-page">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Lazybee</Link>
            <span aria-hidden="true">/</span>
            <Link to={blogRoot}>{blogLabel}</Link>
            {tagsAreLinks && article.tags[0] && (
              <>
                <span aria-hidden="true">/</span>
                <Link to={`/hive/topic/${slugify(article.tags[0])}`}>{article.tags[0]}</Link>
              </>
            )}
          </nav>

          <header className="post-head">
            <h1 className="h1 posttitle">{article.title}</h1>
            {article.excerpt && <p className="body standfirst">{article.excerpt}</p>}
            <div className="byline">
              <span className="label">{article.author}</span>
              <span className="label">
                <time dateTime={article.date}>{article.dateLabel}</time>
              </span>
              <span className="label">{article.readingMinutes} min read</span>
            </div>
          </header>

          {article.hero && (
            <figure className="posthero media">
              <img src={article.hero} alt={article.heroAlt || ''} />
            </figure>
          )}

          {/* Safe by construction: renderMarkdown escapes its input before it emits
              a single tag, so nothing in a .md file can become markup the renderer
              did not choose to produce. See src/lib/markdown.js. */}
          <div className="prose" dangerouslySetInnerHTML={{ __html: rendered.html }} />

          <footer className="post-foot">
            {article.tags.length > 0 && (
              <div className="taglist">
                <span className="label">Filed under</span>
                {article.tags.map((t) => (
                  tagsAreLinks
                    ? <Link key={t} className="chip" to={`/hive/topic/${slugify(t)}`}>{t}</Link>
                    : <span key={t} className="chip">{t}</span>
                ))}
              </div>
            )}

            {readElsewhere.length > 0 && (
              <div className="taglist">
                <span className="label">Also available in</span>
                {readElsewhere.map(({ lang: code, article: a }) => (
                  <Link key={code} className="chip" to={a.path} lang={LANGUAGES[code].htmlLang}>
                    {LANGUAGES[code].label}
                  </Link>
                ))}
              </div>
            )}

            <div className="nextprev">
              {newer ? (
                <Link className="np" to={newer.path} rel="prev">
                  <span className="label">Newer</span>
                  <span className="t">{newer.title}</span>
                </Link>
              ) : <span />}
              {older && (
                <Link className="np right" to={older.path} rel="next">
                  <span className="label">Older</span>
                  <span className="t">{older.title}</span>
                </Link>
              )}
            </div>
          </footer>
        </article>

        {related.length > 0 && (
          <section className="wrap relatedbox">
            <h2 className="h2">More from the blog</h2>
            <div className="list">
              {related.map((a) => <ArticleCard key={a.slug} article={a} />)}
            </div>
            <p className="small backline"><Link to={blogRoot}>Everything we have written</Link></p>
          </section>
        )}

        <section className="band postcta">
          <div className="wrap ctarow">
            <div>
              <div className="label ctalabel">Nineteen rooms, three homes</div>
              <p className="h2 ctahead">Rooms from S$600 to S$2,200 a month, bills in, three month minimum.</p>
            </div>
            <div className="ctabtns">
              <a className="btn btn-accent" href={BOOKING_URL}>Find a room</a>
              <Link className="btn btn-ghost ctaghost" to="/">Own a unit</Link>
            </div>
          </div>
        </section>
      </main>

      <HiveFooter />
    </LazybeeRoot>
  );
}
