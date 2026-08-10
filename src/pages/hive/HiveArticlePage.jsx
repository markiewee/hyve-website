// src/pages/hive/HiveArticlePage.jsx
//
// /hive/:slug
//
// Every article links out to its subjects, to the article either side of it in
// time, and to three related pieces. That is deliberate: an archive that is only
// a flat reverse-chronological list gives a crawler exactly one path in and one
// path out, and everything past the first page sits at the bottom of it. The
// cross links turn the archive into a mesh instead, which is the difference
// between the long tail being indexed and being technically present.

import { useMemo, useRef } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';

import { articleBySlug, ARTICLES, relatedTo, neighboursOf } from '../../lib/hiveContent';
import { articleMeta, HIVE_TITLE } from '../../lib/hiveRoutes';
import { renderMarkdown } from '../../lib/markdown';
import { slugify } from '../../lib/hiveArticles';
import { usePageMeta } from '../../lib/pageMeta';
import { useReveal } from '../../hooks/useReveal';
import { useScrollTop } from '../../hooks/useScrollTop';
import { BOOKING_URL } from '../../lib/booking';
import { HiveHeader, HiveFooter, ArticleCard } from '../../components/hive/HiveChrome';

import '../../styles/lazybee.css';

export default function HiveArticlePage() {
  const { slug } = useParams();
  const article = articleBySlug(slug);

  const rootRef = useRef(null);
  useReveal(rootRef, slug);
  useScrollTop(slug);

  usePageMeta(article ? articleMeta(article) : { title: `${HIVE_TITLE} | Lazybee`, robots: 'noindex,follow' });

  /* Parsing markdown is cheap, but it is pure and it runs on every theme toggle
     otherwise, and a theme toggle should not re-parse the article. */
  const rendered = useMemo(() => (article ? renderMarkdown(article.body) : null), [article]);

  if (!article) return <Navigate to="/hive" replace />;

  const related = relatedTo(article, ARTICLES);
  const { newer, older } = neighboursOf(article, ARTICLES);

  return (
    <div className="lzb hive" data-theme="alabaster" ref={rootRef}>
      <HiveHeader />

      <main id="top">
        <article className="wrap post-page">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Lazybee</Link>
            <span aria-hidden="true">/</span>
            <Link to="/hive">The Hive</Link>
            {article.tags[0] && (
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
            <div className="taglist">
              <span className="label">Filed under</span>
              {article.tags.map((t) => (
                <Link key={t} className="chip" to={`/hive/topic/${slugify(t)}`}>{t}</Link>
              ))}
            </div>

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
            <h2 className="h2">More from The Hive</h2>
            <div className="list">
              {related.map((a) => <ArticleCard key={a.slug} article={a} />)}
            </div>
            <p className="small backline"><Link to="/hive">Everything we have written</Link></p>
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
    </div>
  );
}
