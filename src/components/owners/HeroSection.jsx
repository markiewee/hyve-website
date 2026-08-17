import { useEffect, useRef, useState } from 'react';
import { HOMES, HOME_HERO } from '../../data/lazybeeRooms';
import { scrollToId } from '../../lib/scrollToId';
import { BOOKING_URL } from '../../lib/booking';
import { track, EVENTS } from '../../lib/analytics';
import { useLanguage } from '../../i18n/LanguageContext';

/* Which variant sets its second line in italic. The line break is a dictionary
   decision rather than a character offset into the headline: the old
   `'Be a lazy'.length` slice cut the English string in the designed place and
   cut a Chinese one mid-word. Each variant now carries line1 and line2, and a
   language that wants one unbroken line simply leaves line2 empty. */
const ITALIC_TAIL = { a: true, b: false, c: false };

function Headline({ variant, t }) {
  const first = t(`owner.hero.${variant}.line1`);
  const rest = t(`owner.hero.${variant}.line2`);
  const hasRest = rest && rest !== `owner.hero.${variant}.line2`;
  return (
    <h1>
      {first}
      {hasRest && <br />}
      {hasRest && (ITALIC_TAIL[variant] ? <><em>{rest}</em>.</> : rest)}
    </h1>
  );
}

/**
 * The hero: a slow carousel of the three homes, the pitch for this visitor's
 * variant, and the rent estimator that every number further down the page hangs off.
 */
export default function HeroSection({ heroRef, variant, estimator, districtLabel, onEstimatorChange }) {
  const { t } = useLanguage();
  const [slide, setSlide] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer.current = setInterval(() => setSlide((s) => (s + 1) % HOMES.length), 6500);
    return () => clearInterval(timer.current);
  }, []);

  const home = HOMES[slide];

  return (
    <div className="hero" id="hero" ref={heroRef}>
      <div>
        {HOMES.map((h, i) => (
          <div className={`frame${i === slide ? ' on' : ''}`} key={h.code}>
            <img
              src={HOME_HERO[h.code]}
              alt=""
              /* Every frame loads eagerly. These are stacked on top of each other and
                 the carousel swaps them on a six second timer, so a lazy frame is
                 still downloading when it is shown and the hero goes black. The first
                 one is the largest paint on the page and keeps priority; the other two
                 have six seconds of head start, which is ample. */
              loading="eager"
              fetchPriority={i === 0 ? 'high' : 'low'}
            />
          </div>
        ))}
      </div>
      <div className="scrim" />

      <div className="mid">
        <div className="eyeb">{t('owner.hero.eyebrow')}</div>
        <div className="hv">
          <Headline variant={variant} t={t} />
          <p className="sub">{t(`owner.hero.${variant}.sub`)}</p>
        </div>

        <form className="instrument glass" onSubmit={(e) => e.preventDefault()}>
          <div className="gf">
            <div className="label">{t('owner.hero.postalCode')}</div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="556114"
              aria-label={t('owner.hero.postalCode')}
              value={estimator.postal}
              onChange={(e) => onEstimatorChange({ postal: e.target.value.replace(/\D/g, '').slice(0, 6) }, 'postal')}
            />
          </div>
          <div className="gf" style={{ flex: '1.55 1 0' }}>
            <div className="label">{t('owner.hero.district')}</div>
            <div className="v">{districtLabel}</div>
          </div>
          <div className="gf">
            <div className="label">{t('owner.hero.floorArea')}</div>
            <div className="v">{t('owner.hero.sqft', { n: estimator.sqft.toLocaleString('en-SG') })}</div>
            <input
              className="range"
              type="range"
              min="400"
              max="2600"
              step="50"
              aria-label={t('owner.hero.floorArea')}
              value={estimator.sqft}
              onChange={(e) => onEstimatorChange({ sqft: +e.target.value }, 'sqft')}
            />
          </div>
          <div className="gf">
            <div className="label">{t('owner.hero.bedrooms')}</div>
            <div className="v">{estimator.beds}</div>
            <input
              className="range"
              type="range"
              min="1"
              max="6"
              step="1"
              aria-label={t('owner.hero.bedrooms')}
              value={estimator.beds}
              onChange={(e) => onEstimatorChange({ beds: +e.target.value }, 'beds')}
            />
          </div>
          <button className="btn btn-accent" type="button" onClick={() => scrollToId('split')}>
            {t('owner.hero.cta')}
          </button>
        </form>
        <p className="trial">{t('owner.hero.trial')}</p>
        {/* The quiet half of the split audience: a tenant who typed lazybee.sg. */}
        <p className="herotenant">
          <a href={BOOKING_URL} onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { placement: 'hero' })}>
            {t('owner.hero.tenantLink')}
          </a>
        </p>
      </div>

      <div className="where">
        <div className="nm">{home.name}</div>
        <div className="ar">{(home.mrt || {}).station || ''}</div>
        <div className="dots">
          {HOMES.map((h, i) => <i key={h.code} className={i === slide ? 'on' : ''} />)}
        </div>
      </div>
    </div>
  );
}
