import { useState, useMemo } from 'react';
import FadeIn from './FadeIn';
import { track, EVENTS } from '../../lib/analytics';

/*
 * Returns Estimator — investor hook on the Lazybee home.
 * Punch in a Singapore postal code + two sliders → live co-living economics,
 * benchmarked off Lazybee's live portfolio (3 properties, 18 rooms, full occupancy).
 * Figures are illustrative; unit-level underwriting lives in the deck.
 */

// First 2 digits of a SG postal code = postal sector → URA district.
// We only need the sector→tier mapping to pick a room-rate benchmark.
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

// Tier → blended room rate (S$/mo), grounded in Lazybee's live S$950–1,500 range.
const CCR = new Set(['D01', 'D02', 'D06', 'D07', 'D09', 'D10', 'D11']); // core central — prime
const RCR = new Set(['D03', 'D04', 'D05', 'D08', 'D12', 'D13', 'D14', 'D15', 'D20']); // rest of central — fringe
const TIER = {
  CCR: { rate: 1450, label: 'Core Central — prime' },
  RCR: { rate: 1200, label: 'City fringe' },
  OCR: { rate: 1000, label: 'Suburban' },
};

function lookup(postal) {
  const digits = (postal || '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  const district = SECTOR_DISTRICT[digits.slice(0, 2)];
  if (!district) return null;
  const tierKey = CCR.has(district) ? 'CCR' : RCR.has(district) ? 'RCR' : 'OCR';
  return { district, name: DISTRICT_NAME[district], tier: TIER[tierKey], tierKey };
}

const OCCUPANCY = 0.92;        // conservative vs the portfolio's trailing 100%
const OPEX_RATE = 0.18;        // wifi, utilities, cleaning, platform, maintenance
const FIT_OUT_PER_ROOM = 3500; // one-time furnishing capex

const sgd = (n) => 'S$' + Math.round(n).toLocaleString('en-SG');

export default function ReturnsEstimator() {
  const [postal, setPostal] = useState('');
  const [rooms, setRooms] = useState(6);
  const [lease, setLease] = useState(5500); // monthly master lease they'd pay the landlord

  const loc = useMemo(() => lookup(postal), [postal]);
  const rate = loc?.tier.rate ?? 1100;

  const m = useMemo(() => {
    const gross = rooms * rate * OCCUPANCY;
    const opex = gross * OPEX_RATE;
    const net = gross - opex - lease;
    const capex = rooms * FIT_OUT_PER_ROOM;
    const margin = gross > 0 ? net / gross : 0;
    const payback = net > 0 ? capex / net : null;
    return { gross, opex, net, capex, margin, annual: net * 12, payback };
  }, [rooms, rate, lease]);

  const positive = m.net > 0;

  return (
    <section className="px-6 md:px-20 py-28 md:py-40 bg-surface">
      <div className="max-w-screen-xl mx-auto">
        <FadeIn className="mb-14 md:mb-20">
          <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-6">Run the numbers</span>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl leading-none max-w-3xl">
            What a unit could return.
          </h2>
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
                onChange={(e) => setPostal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onBlur={() => loc && track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'estimator', intent: 'postal', district: loc.district })}
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

            {/* Rooms */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-[11px] uppercase tracking-[0.3em] font-semibold text-foreground-variant">Rooms in the unit</label>
                <span className="font-display text-2xl font-bold text-white">{rooms}</span>
              </div>
              <input
                type="range" min={3} max={9} step={1} value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
                className="w-full accent-[#c47a35]"
              />
            </div>

            {/* Master lease */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-[11px] uppercase tracking-[0.3em] font-semibold text-foreground-variant">Your monthly lease</label>
                <span className="font-display text-2xl font-bold text-white">{sgd(lease)}</span>
              </div>
              <input
                type="range" min={3000} max={12000} step={250} value={lease}
                onChange={(e) => setLease(Number(e.target.value))}
                className="w-full accent-[#c47a35]"
              />
              <p className="mt-3 text-xs text-foreground-variant/60">
                What you'd pay the landlord. Room rate auto-set from the postal code ({sgd(rate)}/room) at {Math.round(OCCUPANCY * 100)}% occupancy.
              </p>
            </div>
          </FadeIn>

          {/* ── Live result ── */}
          <FadeIn className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 md:p-12 flex flex-col justify-between">
            <div>
              <span className="block text-[11px] uppercase tracking-[0.3em] font-semibold text-foreground-variant mb-3">
                Estimated net profit / month
              </span>
              <p className={`font-display font-bold tracking-display leading-none text-6xl md:text-7xl ${positive ? 'text-accent' : 'text-red-400'}`}>
                {positive ? sgd(m.net) : '—' + sgd(Math.abs(m.net))}
              </p>
              <p className="mt-4 text-foreground-variant">
                {positive
                  ? <>≈ <span className="text-foreground font-medium">{sgd(m.annual)}</span> a year · {Math.round(m.margin * 100)}% net margin</>
                  : <>This lease is above what the rooms can carry here — drag it down.</>}
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5">
              <Stat label="Gross / mo" value={sgd(m.gross)} />
              <Stat label="Fit-out" value={sgd(m.capex)} />
              <Stat label="Payback" value={m.payback ? Math.ceil(m.payback) + ' mo' : '—'} />
            </div>

            <p className="mt-8 text-[11px] leading-relaxed text-foreground-variant/50">
              Illustrative only, based on Lazybee's live portfolio assumptions ({Math.round(OCCUPANCY * 100)}% occupancy,
              {' '}{Math.round(OPEX_RATE * 100)}% opex, {sgd(FIT_OUT_PER_ROOM)}/room fit-out). Not an offer or financial advice.
              Unit-level underwriting is in the deck.
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
