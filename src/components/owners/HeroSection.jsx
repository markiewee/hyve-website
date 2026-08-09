import { useEffect, useRef, useState } from 'react';
import { HOMES, HOME_HERO } from '../../data/lazybeeRooms';
import { scrollToId } from '../../lib/scrollToId';

/* Where the designed line break falls in each headline. The copy itself lives in
   src/lib/experiment.js and is not repeated here, so the split test and the page
   can never disagree about what was shown. Only the typography is local. */
const BREAK_AT = { a: 'Be a lazy'.length, b: 'We pay first.'.length, c: 'What is your unit'.length };
const ITALIC_TAIL = { a: true, b: false, c: false };

function Headline({ variant, headline }) {
  const at = BREAK_AT[variant] ?? headline.length;
  const first = headline.slice(0, at).trim();
  const rest = headline.slice(at).trim();
  return (
    <h1>
      {first}
      {rest && <br />}
      {ITALIC_TAIL[variant] ? <><em>{rest}</em>.</> : rest}
    </h1>
  );
}

/**
 * The hero: a slow carousel of the three homes, the pitch for this visitor's
 * variant, and the rent estimator that every number further down the page hangs off.
 */
export default function HeroSection({ heroRef, variant, copy, estimator, districtLabel, onEstimatorChange }) {
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
        <div className="eyeb">For unit owners in Singapore</div>
        <div className="hv">
          <Headline variant={variant} headline={copy.headline} />
          <p className="sub">{copy.sub}</p>
        </div>

        <form className="instrument glass" onSubmit={(e) => e.preventDefault()}>
          <div className="gf">
            <div className="label">Postal code</div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="556114"
              aria-label="Postal code"
              value={estimator.postal}
              onChange={(e) => onEstimatorChange({ postal: e.target.value.replace(/\D/g, '').slice(0, 6) }, 'postal')}
            />
          </div>
          <div className="gf" style={{ flex: '1.55 1 0' }}>
            <div className="label">District</div>
            <div className="v">{districtLabel}</div>
          </div>
          <div className="gf">
            <div className="label">Floor area</div>
            <div className="v">{estimator.sqft.toLocaleString('en-SG')} sqft</div>
            <input
              className="range"
              type="range"
              min="400"
              max="2600"
              step="50"
              aria-label="Floor area"
              value={estimator.sqft}
              onChange={(e) => onEstimatorChange({ sqft: +e.target.value }, 'sqft')}
            />
          </div>
          <div className="gf">
            <div className="label">Bedrooms</div>
            <div className="v">{estimator.beds}</div>
            <input
              className="range"
              type="range"
              min="1"
              max="6"
              step="1"
              aria-label="Bedrooms"
              value={estimator.beds}
              onChange={(e) => onEstimatorChange({ beds: +e.target.value }, 'beds')}
            />
          </div>
          <button className="btn btn-accent" type="button" onClick={() => scrollToId('split')}>
            Show me the split
          </button>
        </form>
        <p className="trial">Ninety days to decide · nothing to pay · nothing to sign today</p>
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
