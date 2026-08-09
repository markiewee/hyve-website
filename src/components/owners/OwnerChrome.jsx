import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_URL } from '../../lib/booking';
import { track, EVENTS } from '../../lib/analytics';
import { scrollToId } from '../../lib/scrollToId';

/** The Lazybee bee, as drawn in the prototype. */
export function BeeMark() {
  return (
    <svg viewBox="13.43 21.63 73.13 57.45" aria-hidden="true" focusable="false">
      <path d="M50.000,78.080Q50.000,69.658 45.141,58.091Q35.950,59.205 30.485,63.562Q35.950,59.205 39.081,50.492Q24.393,42.155 14.435,39.882Q24.393,42.155 41.243,41.017Q41.203,29.733 37.782,22.629Q41.203,29.733 50.000,36.800Q58.797,29.733 62.218,22.629Q58.797,29.733 58.757,41.017Q75.607,42.155 85.565,39.882Q75.607,42.155 60.919,50.492Q64.050,59.205 69.515,63.562Q64.050,59.205 54.859,58.091Q50.000,69.658 50.000,78.080Z" />
    </svg>
  );
}

/* Nav labels say what the owner gets, not what we called the section internally.
   "Free coffee" is deliberate: it is the actual offer at the bottom of the page,
   and naming it is what makes a stranger click it. The Hive is a real route, not
   an anchor, so it carries a `to` instead of a section id. */
const NAV = [
  ['Your split', 'split'],
  ['Versus a lease', 'compare'],
  ['The comb', 'comb'],
  /* The Hive goes back in the moment the /hive route ships. Linking to a
     route that does not exist is worse than not linking to it. */
  ['Free coffee', 'ask'],
];

/**
 * Fixed header. Transparent over the hero photograph, solid once the hero is gone.
 * The observer watches the hero rather than a scroll position so it stays correct
 * when the hero height changes between a phone and a desktop.
 */
export function OwnerHeader({ heroRef, theme, onToggleTheme }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting), { threshold: 0.06 });
    io.observe(hero);
    return () => io.disconnect();
  }, [heroRef]);

  return (
    <header className={`lzbheader${solid ? ' solid' : ''}`}>
      <a
        className="brandlock"
        href="#top"
        onClick={(e) => { e.preventDefault(); scrollToId('top'); }}
        aria-label="Lazybee, back to the top"
      >
        <BeeMark />
        <span className="wd">LAZYBEE</span>
      </a>
      <nav className="navlinks">
        {NAV.map(([label, id, to]) => (
          to
            ? <Link key={label} to={to}>{label}</Link>
            : <a key={label} href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToId(id); }}>{label}</a>
        ))}
        <button className="modebtn" type="button" onClick={onToggleTheme}>
          {theme === 'tobacco' ? 'Light' : 'Dark'}
        </button>
      </nav>
    </header>
  );
}

export function OwnerFooter() {
  return (
    <footer className="lzbfooter wrap">
      <a
        className="brandlock"
        href="#top"
        onClick={(e) => { e.preventDefault(); scrollToId('top'); }}
        style={{ color: 'var(--ink)' }}
      >
        <BeeMark />
        <span className="wd">LAZYBEE</span>
      </a>
      <p className="label">
        Makery Pte Ltd · Singapore ·{' '}
        <a
          href={BOOKING_URL}
          className="accent"
          style={{ textDecoration: 'none' }}
          onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'owner_footer' })}
        >
          Looking for a room instead?
        </a>{' '}
        {/* Every other indexable page hangs off this footer. The homepage is the
            only page a crawler is guaranteed to reach, so if a route is not linked
            from here it is an orphan no matter what the sitemap says. */}
        · <a href="/faqs" style={{ textDecoration: 'none' }}>FAQs</a>{' '}
        · <a href="/contact" style={{ textDecoration: 'none' }}>Contact</a>{' '}
        · <a href="/privacy-policy" style={{ textDecoration: 'none' }}>Privacy</a>{' '}
        · <a href="/terms-of-service" style={{ textDecoration: 'none' }}>Terms</a>{' '}
        · <a href="/cookie-policy" style={{ textDecoration: 'none' }}>Cookies</a>
      </p>
    </footer>
  );
}
