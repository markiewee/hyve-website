import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_URL } from '../../lib/booking';
import { track, EVENTS } from '../../lib/analytics';
import { scrollToId } from '../../lib/scrollToId';
import { useLanguage } from '../../i18n/LanguageContext';
import LangSwitch from '../../i18n/LangSwitch';
import ThemeToggle from '../ThemeToggle';

/** The Lazybee bee, as drawn in the prototype. */
export function BeeMark() {
  return (
    <svg viewBox="13.43 21.63 73.13 57.45" aria-hidden="true" focusable="false">
      <path d="M50.000,78.080Q50.000,69.658 45.141,58.091Q35.950,59.205 30.485,63.562Q35.950,59.205 39.081,50.492Q24.393,42.155 14.435,39.882Q24.393,42.155 41.243,41.017Q41.203,29.733 37.782,22.629Q41.203,29.733 50.000,36.800Q58.797,29.733 62.218,22.629Q58.797,29.733 58.757,41.017Q75.607,42.155 85.565,39.882Q75.607,42.155 60.919,50.492Q64.050,59.205 69.515,63.562Q64.050,59.205 54.859,58.091Q50.000,69.658 50.000,78.080Z" />
    </svg>
  );
}

/* Nav labels name the thing, not the metaphor. An owner landing cold gets about
   three seconds to work out what each one opens, and "The comb" and "Free coffee"
   spent that budget on charm: one is the live grid of real rooms at real prices,
   the other is the earnings estimator. Guides is a real route rather than an
   anchor, so it carries a `to` instead of a section id. */
/* `nav.compare` used to open the comparison table. That section was retired for
   repeating the estimator, so the label now opens the alignment section, which
   is the argument it was always pointing at. */
const NAV = [
  ['nav.earnings', 'split'],
  ['nav.compare', 'why'],
  ['nav.portfolio', 'comb'],
  ['nav.guides', null, '/hive'],
  ['nav.estimate', 'ask'],
];

/**
 * Fixed header. Transparent over the hero photograph, solid once the hero is gone.
 * The observer watches the hero rather than a scroll position so it stays correct
 * when the hero height changes between a phone and a desktop.
 */
export function OwnerHeader({ heroRef }) {
  const [solid, setSolid] = useState(false);
  const { t } = useLanguage();

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
        {NAV.map(([key, id, to]) => (
          to
            ? <Link key={key} to={to}>{t(key)}</Link>
            : <a key={key} href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToId(id); }}>{t(key)}</a>
        ))}
        {/* This page sells to owners, but lazybee.sg is the brand address a tenant
            types. Without this the only route to the booking site is clicking a cell
            inside the comb, which a room-hunter has no reason to try. */}
        <a
          className="navbook"
          href={BOOKING_URL}
          onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { placement: 'nav' })}
        >
          {t('nav.findRoom')}
        </a>
        <ThemeToggle />
        <LangSwitch />
      </nav>
    </header>
  );
}

export function OwnerFooter() {
  const { t } = useLanguage();
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
        · <Link to="/hive" style={{ textDecoration: 'none' }}>{t('nav.guides')}</Link>{' '}
        · <a href="/faqs" style={{ textDecoration: 'none' }}>FAQs</a>{' '}
        · <a href="/contact" style={{ textDecoration: 'none' }}>Contact</a>{' '}
        · <a href="/privacy-policy" style={{ textDecoration: 'none' }}>Privacy</a>{' '}
        · <a href="/terms-of-service" style={{ textDecoration: 'none' }}>Terms</a>{' '}
        · <a href="/cookie-policy" style={{ textDecoration: 'none' }}>Cookies</a>
      </p>
    </footer>
  );
}
