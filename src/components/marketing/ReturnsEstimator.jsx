import { useState, useMemo } from 'react';
import FadeIn from './FadeIn';
import { track, EVENTS } from '../../lib/analytics';

/*
 * Landlord estimator, "what your unit could earn with Lazybee".
 * Postal code → market PSF · square footage → market rent · bathrooms →
 * how many ensuite / lettable rooms the unit typically yields.
 * Lazybee manages it and pays a guaranteed lease above open-market rent.
 * Illustrative; real offers are made after a viewing.
 */

// First 2 digits of a SG postal code = postal sector → URA district.
const SECTOR_DISTRICT = {
  '01': 'D01', '02': 'D01', '03': 'D01', '04': 'D01', '05': 'D01', '06': 'D01',
  '07': 'D02', '08': 'D02', '14': 'D03', '15': 'D03', '16': 'D03',
  '09': 'D04', '10': 'D04', '11': 'D05', '12': 'D05', '13': 'D05', '17': 'D06',
  '18': 'D07', '19': 'D07', '20': 'D08', '21': 'D08', '22': 'D09', '23': 'D09',
  '24': 'D10', '25': 'D10', '26': 'D10', '27': 'D10', '28': 'D11', '29': 'D11', '30': 'D11',
  '31': 'D12', '32': 'D12', '33': 'D12', '34': 'D13', '35': 'D13', '36': 'D13', '37': 'D13',
  '38': 'D14', '39': 'D14', '40': 'D14', '41': 'D14', '42': 'D15', '43': 'D15', '44': 'D15', '45': 'D15',
  '46': 'D16', '47': 'D16', '48': 'D16', '49': 'D17', '50': 'D17', '81': 'D17',
  '51': 'D18', '52': 'D18', '53': 'D19', '54': 'D19', '55': 'D19', '82': 'D19',
  '56': 'D20', '57': 'D20', '58': 'D21', '59': 'D21',
  '60': 'D22', '61': 'D22', '62': 'D22', '63': 'D22', '64': 'D22',
  '65': 'D23', '66': 'D23', '67': 'D23', '68': 'D23', '69': 'D24', '70': 'D24', '71': 'D24',
  '72': 'D25', '73': 'D25', '77': 'D26', '78': 'D26', '75': 'D27', '76': 'D27', '79': 'D28', '80': 'D28',
};

const DISTRICT_NAME = {
  D01: 'Raffles Place / Marina', D02: 'Tanjong Pagar / Chinatown', D03: 'Tiong Bahru / Queenstown',
  D04: 'Sentosa / Harbourfront', D05: 'Clementi / West Coast', D06: 'City Hall / Clarke Quay',
  D07: 'Bugis / Beach Road', D08: 'Little India / Farrer Park', D09: 'Orchard / River Valley',
  D10: 'Bukit Timah / Holland', D11: 'Novena / Newton', D12: 'Toa Payoh / Balestier',
  D13: 'MacPherson / Potong Pasir', D14: 'Geylang / Paya Lebar', D15: 'East Coast / Katong',
  D16: 'Bedok / Upper East Coast', D17: 'Changi / Loyang', D18: 'Tampines / Pasir Ris',
  D19: 'Serangoon / Hougang / Punggol', D20: 'Bishan / Ang Mo Kio', D21: 'Clementi Park / Upper Bukit Timah',
  D22: 'Jurong / Boon Lay', D23: 'Bukit Batok / Choa Chu Kang', D24: 'Lim Chu Kang / Tengah',
  D25: 'Woodlands / Admiralty', D26: 'Mandai / Upper Thomson', D27: 'Yishun / Sembawang', D28: 'Seletar / Yio Chu Kang',
};

// Tier → default market rental PSF (S$/sqft/mo) for the area.
const CCR = new Set(['D01', 'D02', 'D06', 'D07', 'D09', 'D10', 'D11']);
const RCR = new Set(['D03', 'D04', 'D05', 'D08', 'D12', 'D13', 'D14', 'D15', 'D20']);
const TIER = {
  CCR: { psf: 5.2, label: 'Core Central, prime' },
  RCR: { psf: 4.3, label: 'City fringe' },
  OCR: { psf: 3.6, label: 'Suburban' },
};

function lookup(postal) {
  const digits = (postal || '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  const district = SECTOR_DISTRICT[digits.slice(0, 2)];
  if (!district) return null;
  const tierKey = CCR.has(district) ? 'CCR' : RCR.has(district) ? 'RCR' : 'OCR';
  return { district, name: DISTRICT_NAME[district], tier: TIER[tierKey], tierKey };
}

const PREMIUM = 0.10;          // what Lazybee pays above open-market whole-unit rent
const LEASE_TERM = '36 months';
const DEFAULT_PSF = 4.0;

// Bathrooms → how the unit typically lets as co-living.
// Master + junior suites are ensuite; one bathroom is the shared/common.
const roomsFromBaths = (b) => b + 1;                 // 2-bath ≈ 3 lettable rooms
const ensuiteFromBaths = (b) => Math.max(b - 1, 0);  // 2-bath ≈ 1 ensuite

const sgd = (n) => 'S$' + Math.round(n).toLocaleString('en-SG');

export default function ReturnsEstimator() {
  const [postal, setPostal] = useState('');
  const [sqft, setSqft] = useState(900);
  const [baths, setBaths] = useState(2);

  const loc = useMemo(() => lookup(postal), [postal]);
  const psf = loc?.tier.psf ?? DEFAULT_PSF;

  const onPostal = (v) => {
    const clean = v.replace(/\D/g, '').slice(0, 6);
    setPostal(clean);
    const l = lookup(clean);
    if (l && clean.length >= 2) {
      track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'estimator', intent: 'postal', district: l.district });
    }
  };

  const m = useMemo(() => {
    const rooms = roomsFromBaths(baths);
    const ensuite = ensuiteFromBaths(baths);
    const market = psf * sqft;
    const pays = market * (1 + PREMIUM);
    return { rooms, ensuite, market, pays, annual: pays * 12 };
  }, [psf, sqft, baths]);

  return (
    <section className="px-6 md:px-20 py-28 md:py-40 bg-surface">
      <div className="max-w-screen-xl mx-auto">
        <FadeIn className="mb-14 md:mb-20">
          <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-6">For landlords</span>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl leading-none max-w-3xl">
            What your unit could earn.
          </h2>
          <p className="mt-6 text-foreground-variant text-lg max-w-2xl leading-relaxed">
            Hand us the keys. We furnish, fill, and manage it end-to-end, and pay you a guaranteed monthly
            lease, typically above open-market rent. No agents, no voids, no chasing tenants.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
          {/* ── Inputs ── */}
          <FadeIn className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 md:p-12 flex flex-col gap-10">
            {/* Postal code */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.3em] font-semibold text-foreground-variant mb-4">
                Singapore postal code
              </label>
              <input
                inputMode="numeric"
                maxLength={6}
                value={postal}
                onChange={(e) => onPostal(e.target.value)}
                placeholder="e.g. 569933"
                className="w-full rounded-full border border-white/10 bg-background/60 px-6 py-4 text-lg tracking-wide text-foreground placeholder:text-foreground-variant/40 outline-none focus:border-accent transition-colors"
              />
              <div className="mt-3 min-h-[1.25rem] text-sm">
                {postal.length >= 2 && (
                  loc ? (
                    <span className="text-foreground-variant">
                      <span className="text-accent font-medium">{loc.district}</span> · {loc.name} ·{' '}
                      <span className="uppercase tracking-wider text-[11px]">{loc.tier.label}</span>
                    </span>
                  ) : (
                    <span className="text-foreground-variant/50">Keep typing a valid SG postal code…</span>
                  )
                )}
              </div>
            </div>

            {/* Square footage */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-[11px] uppercase tracking-[0.3em] font-semibold text-foreground-variant">Floor area</label>
                <span className="font-display text-2xl font-bold text-white">{sqft.toLocaleString('en-SG')}<span className="text-sm text-white/50"> sqft</span></span>
              </div>
              <input
                type="range" min={400} max={3000} step={50} value={sqft}
                onChange={(e) => setSqft(Number(e.target.value))}
                className="w-full accent-[#c47a35]"
              />
              <p className="mt-3 text-xs text-foreground-variant/60">
                Market rate here ≈ S${psf.toFixed(1)}/sqft → {sgd(m.market)}/mo whole-unit rent.
              </p>
            </div>

            {/* Bathrooms */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-[11px] uppercase tracking-[0.3em] font-semibold text-foreground-variant">Bathrooms</label>
                <span className="font-display text-2xl font-bold text-white">{baths}</span>
              </div>
              <input
                type="range" min={1} max={5} step={1} value={baths}
                onChange={(e) => setBaths(Number(e.target.value))}
                className="w-full accent-[#c47a35]"
              />
              <p className="mt-3 text-xs text-foreground-variant/60">
                Typically lets as <span className="text-foreground-variant">{m.rooms} rooms</span>
                {m.ensuite > 0 && <> · {m.ensuite} ensuite</>}.
              </p>
            </div>
          </FadeIn>

          {/* ── Live result ── */}
          <FadeIn className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 md:p-12 flex flex-col justify-between">
            <div>
              <span className="block text-[11px] uppercase tracking-[0.3em] font-semibold text-foreground-variant mb-3">
                Lazybee pays you / month
              </span>
              <p className="font-display font-bold tracking-display leading-none text-6xl md:text-7xl text-accent">
                {sgd(m.pays)}
              </p>
              <p className="mt-4 text-foreground-variant">
                ≈ <span className="text-foreground font-medium">{Math.round(PREMIUM * 100)}% above</span> the{' '}
                {sgd(m.market)} open-market rent · guaranteed · fully managed
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5">
              <Stat label="Per year" value={sgd(m.annual)} />
              <Stat label="Lets as" value={`${m.rooms} rooms`} />
              <Stat label="Lease" value={LEASE_TERM} />
            </div>

            <a
              href="/contact"
              onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'estimator', intent: 'manage_unit' })}
              className="mt-8 inline-flex items-center justify-center gap-3 rounded-full bg-accent text-accent-foreground px-10 py-4 font-semibold text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all"
            >
              Contact us to manage it <span aria-hidden>→</span>
            </a>

            <p className="mt-6 text-[11px] leading-relaxed text-foreground-variant/50">
              Illustrative only, a guaranteed offer is made after a quick viewing. Figures assume a
              {' '}{Math.round(PREMIUM * 100)}% premium to open-market rent on a {LEASE_TERM} managed lease.
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="px-4 py-5 text-center">
      <p className="font-display text-xl md:text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/55">{label}</p>
    </div>
  );
}
