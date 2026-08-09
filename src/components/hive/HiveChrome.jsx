// src/components/hive/HiveChrome.jsx
//
// The shell every Hive page sits in: theme wrapper, header, banner, footer, and
// the card and chip pieces the three routes share.
//
// Two things here are fixes to the approved prototype rather than ports of it.
//
// 1. The banner. In design-preview/hive.html the green panel keeps its green
//    background in both themes while its text follows --ink, and --ink flips to a
//    near black in tobacco. Measured on the prototype that is 1.18:1 on the
//    headline and 1.58:1 on the label, against a floor of 4.5:1. The colours here
//    are pinned to the light ink rather than inherited, so the banner reads the
//    same in both themes. See the .hivebanner block in lazybee.css.
//
// 2. The header. The prototype's .topbar puts the nav on flex-wrap:nowrap, which
//    pushes document.scrollWidth to a constant 450px and scrolls the body sideways
//    on every phone. This header wraps, and the owner page rule that hides nav
//    links below 1000px is deliberately not applied: on a blog the nav links are
//    part of how a crawler and a reader both get around.

import { Link } from 'react-router-dom';
import { BeeMark } from '../owners/OwnerChrome';
import { BOOKING_URL } from '../../lib/booking';

/** Static header. Real links, so every Hive page is reachable without JavaScript. */
export function HiveHeader({ theme, onToggleTheme }) {
  return (
    <header className="hivehead">
      <Link className="brandlock" to="/" aria-label="Lazybee, back to the home page">
        <BeeMark />
        <span className="wd">LAZYBEE</span>
      </Link>
      <nav className="navlinks" aria-label="Primary">
        <Link to="/">For owners</Link>
        <a href={BOOKING_URL}>Find a room</a>
        <Link to="/hive" aria-current="page">The Hive</Link>
        <button className="modebtn" type="button" onClick={onToggleTheme}>
          {theme === 'tobacco' ? 'Light' : 'Dark'}
        </button>
      </nav>
    </header>
  );
}

export function HiveFooter() {
  return (
    <footer className="lzbfooter wrap">
      <Link className="brandlock" to="/" style={{ color: 'var(--ink)' }}>
        <BeeMark />
        <span className="wd">LAZYBEE</span>
      </Link>
      <p className="label">
        Makery Pte Ltd · Singapore ·{' '}
        <Link to="/hive" style={{ textDecoration: 'none' }}>The Hive</Link> ·{' '}
        <a href={BOOKING_URL} className="accent" style={{ textDecoration: 'none' }}>Find a room</a> ·{' '}
        <Link to="/privacy-policy" style={{ textDecoration: 'none' }}>Privacy</Link> ·{' '}
        <Link to="/terms-of-service" style={{ textDecoration: 'none' }}>Terms</Link> ·{' '}
        <Link to="/contact" style={{ textDecoration: 'none' }}>Contact</Link>
      </p>
    </footer>
  );
}

/**
 * A quiet comb behind the banner. Drawn once, as static markup rather than in an
 * effect, so it is in the HTML a crawler receives and does not depend on a script
 * having run. aria-hidden because it is texture, not information.
 */
function CombTexture() {
  const R = 17, SQ3 = Math.sqrt(3), W = 1600, H = 460;
  const cells = [];
  for (let r = -1; r <= Math.ceil(H / (1.5 * R)) + 1; r += 1) {
    for (let q = -2; q <= Math.ceil(W / (SQ3 * R)) + 2; q += 1) {
      const x = SQ3 * R * (q + r / 2), y = 1.5 * R * r;
      if (x < -R || x > W + R) continue;
      const pts = [];
      for (let i = 0; i < 6; i += 1) {
        const a = ((90 + 60 * i) * Math.PI) / 180;
        pts.push(`${(x + R * 0.92 * Math.cos(a)).toFixed(1)},${(y - R * 0.92 * Math.sin(a)).toFixed(1)}`);
      }
      cells.push(<polygon key={`${r}-${q}`} points={pts.join(' ')} />);
    }
  }
  return (
    <div className="cells" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">{cells}</svg>
    </div>
  );
}

/**
 * The green masthead. `count` is passed in by each route rather than hardcoded,
 * which is the other prototype defect: its "8 pieces" was a literal that never
 * moved when the filter changed.
 */
export function HiveBanner({ kicker, title, blurb, count, subjects, cadence = 'Monthly at most' }) {
  return (
    <header className="hivebanner">
      <CombTexture />
      <div className="wrap bin">
        <div className="label">{kicker}</div>
        <h1 className="display">{title}</h1>
        {blurb && <p className="blurb">{blurb}</p>}
        <div className="bmeta">
          <span><b>{count}</b> {count === 1 ? 'piece' : 'pieces'}</span>
          {subjects !== undefined && (
            <span><b>{subjects}</b> {subjects === 1 ? 'subject' : 'subjects'}</span>
          )}
          <span><b>{cadence}</b></span>
        </div>
      </div>
    </header>
  );
}

/**
 * The subject chips.
 *
 * Anchors, not buttons. In the prototype these filtered the list with JavaScript,
 * which meant the filtered view had no URL, could not be linked to, and could not
 * be crawled. Here each one is a real page: /hive/topic/rules exists, has its own
 * title, and lists every article carrying that tag.
 */
export function TopicChips({ topics, activeSlug }) {
  return (
    <nav className="filters" aria-label="Subjects">
      <Link className={`chip${activeSlug ? '' : ' on'}`} to="/hive" aria-current={activeSlug ? undefined : 'page'}>
        All
      </Link>
      {topics.map((t) => (
        <Link
          key={t.slug}
          className={`chip${activeSlug === t.slug ? ' on' : ''}`}
          to={`/hive/topic/${t.slug}`}
          aria-current={activeSlug === t.slug ? 'page' : undefined}
        >
          {t.label} <span className="cnt">{t.articles.length}</span>
        </Link>
      ))}
    </nav>
  );
}

/** The oversized card at the top of a listing. Always the newest of whatever is being listed. */
export function LeadCard({ article, kicker }) {
  return (
    <Link className="lead-post rv" to={article.path}>
      {article.hero && (
        <div className="im"><img src={article.hero} alt={article.heroAlt || ''} /></div>
      )}
      <div className="bd">
        <div className="label">{kicker} · {article.tags[0] || 'Lazybee'}</div>
        <h2 className="h1 leadtitle">{article.title}</h2>
        <p className="body leadbody">{article.excerpt}</p>
        <div className="label leadmeta">{article.dateLabel} · {article.readingMinutes} min read</div>
      </div>
    </Link>
  );
}

/**
 * One article in the grid.
 *
 * Deliberately not a .rv reveal target, which matches the prototype: only its lead
 * post reveals, the grid is always painted. On a page whose content is the list of
 * articles, hiding the list at opacity 0 until an IntersectionObserver fires is a
 * risk with no upside, and observer callbacks are throttled in background tabs.
 */
export function ArticleCard({ article }) {
  return (
    <Link className="item" to={article.path}>
      {article.hero && (
        <div className="im"><img src={article.hero} alt={article.heroAlt || ''} loading="lazy" /></div>
      )}
      <div className="label cardtag">{article.tags.join(' · ')}</div>
      <div className="h">{article.title}</div>
      <p className="small carddek">{article.excerpt}</p>
      <div className="meta">
        <span className="fine">{article.dateLabel}</span>
        <span className="fine">{article.readingMinutes} min read</span>
      </div>
    </Link>
  );
}

/**
 * Numbered pagination, as real links.
 *
 * Every page number is an <a href>, so the whole archive is walkable by a crawler
 * that does not run JavaScript. rel="prev" and rel="next" are on the anchors as
 * well as in the head, which is what tells a crawler these pages are one sequence
 * rather than a set of near duplicates.
 */
export function Pagination({ page, pageCount }) {
  if (pageCount <= 1) return null;
  const href = (p) => (p === 1 ? '/hive' : `/hive/page/${p}`);

  /* Up to nine numbers are all shown. Past that the row is windowed to the first
     page, the last page and the two either side of this one, so the control stays
     one line on a phone. Nothing becomes unreachable: the Older link walks the
     whole sequence one page at a time, which is how a crawler traverses it anyway. */
  const all = Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages =
    pageCount <= 9
      ? all
      : all.filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2);

  return (
    <nav className="pager" aria-label="Pages of The Hive">
      {page > 1 && <Link className="pg prev" rel="prev" to={href(page - 1)}>Newer</Link>}
      <ol className="pgnums">
        {pages.map((p, i) => (
          <li key={p}>
            {i > 0 && p - pages[i - 1] > 1 && <span className="gap" aria-hidden="true">...</span>}
            {p === page ? (
              <span className="pg on" aria-current="page">{p}</span>
            ) : (
              <Link className="pg" to={href(p)} aria-label={`Page ${p}`}>{p}</Link>
            )}
          </li>
        ))}
      </ol>
      {page < pageCount && <Link className="pg next" rel="next" to={href(page + 1)}>Older</Link>}
    </nav>
  );
}
