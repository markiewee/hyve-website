import { useEffect, useState, useRef } from 'react';
import { BOOKING_URL } from '../../lib/booking';
import { track, EVENTS } from '../../lib/analytics';

const SLIDES = [
  {
    name: 'Chiltern Park',
    image: '/photos/cp-hero.jpg',
    stats: [
      { value: '6', label: 'Rooms' },
      { value: '$950', label: 'From / month' },
      { value: '3 mo', label: 'Min stay' },
    ],
  },
  {
    name: 'Thomson Grove',
    image: '/photos/tg-hero.jpg',
    stats: [
      { value: '6', label: 'Rooms' },
      { value: '$950', label: 'From / month' },
      { value: '3 mo', label: 'Min stay' },
    ],
  },
  {
    name: 'Ivory Heights',
    image: '/photos/ih-hero.jpg',
    stats: [
      { value: '7', label: 'Rooms' },
      { value: '$950', label: 'From / month' },
      { value: '3 mo', label: 'Min stay' },
    ],
  },
];

const MOVE_IN = [
  { value: '', label: 'Anytime' },
  { value: 'now', label: 'Within 2 weeks' },
  { value: '30', label: 'Within 30 days' },
  { value: '60', label: 'Within 60 days' },
];

const BUDGET = [
  { value: '', label: 'Any budget' },
  { value: '800', label: 'Around $800' },
  { value: '1000', label: 'Around $1,000' },
  { value: '1200', label: 'Around $1,200' },
  { value: '1500', label: 'Around $1,500' },
  { value: '2000', label: 'Around $2,000' },
];

function Select({ label, placeholder, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const current = options.find((o) => o.value === value)?.label ?? placeholder;
  return (
    <div ref={ref} className="relative flex-1 px-5 py-3 md:py-4">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full text-left"
      >
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/55">{label}</div>
        <div className="mt-1 flex items-center justify-between gap-2 text-sm text-white md:text-base">
          <span className={value ? '' : 'text-white/85'}>{current}</span>
          <span className="text-white/50">▾</span>
        </div>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 backdrop-blur-2xl shadow-2xl">
          {options.map((o) => (
            <button
              key={o.value || 'any'}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`block w-full px-5 py-3 text-left text-sm transition hover:bg-white/10 ${
                value === o.value ? 'text-accent' : 'text-white/85'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BookingHero({ subtitle = 'by Lazybee' }) {
  const [active, setActive] = useState(0);
  const [moveIn, setMoveIn] = useState('');
  const [budget, setBudget] = useState('');

  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const onSearch = () => {
    track(EVENTS.BROWSE_ROOMS_CLICK, { source: 'hero_search', move_in: moveIn || 'any', budget: budget || 'any' });
    const params = new URLSearchParams();
    if (moveIn) params.set('move_in', moveIn);
    if (budget) params.set('budget', budget);
    const qs = params.toString();
    window.location.href = qs ? `${BOOKING_URL}/?${qs}` : BOOKING_URL;
  };

  const current = SLIDES[active];

  return (
    <section className="relative h-screen w-full overflow-hidden bg-neutral-900">
      {SLIDES.map((s, idx) => (
        <img
          key={s.image}
          src={s.image}
          alt=""
          className={`kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            idx === active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/75" />

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display tracking-display text-6xl font-bold leading-[0.98] text-white md:text-8xl">
          {current.name}
        </h1>
        <p className="mt-4 text-sm uppercase tracking-[0.3em] text-white/80 md:text-base">{subtitle}</p>

        <div className="mt-12 w-full max-w-4xl mx-auto">
          <div className="relative rounded-3xl border border-white/10 bg-white/5">
            <div className="pointer-events-none absolute inset-0 rounded-3xl backdrop-blur-2xl" />
            <div className="relative flex flex-col items-stretch divide-y divide-white/10 p-2 md:flex-row md:items-center md:divide-x md:divide-y-0">
              <Select label="Move in" placeholder="Anytime" value={moveIn} options={MOVE_IN} onChange={setMoveIn} />
              <Select label="Monthly budget" placeholder="Any budget" value={budget} options={BUDGET} onChange={setBudget} />
              <div className="p-1">
                <button
                  type="button"
                  onClick={onSearch}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-8 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-90 md:w-auto"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-10 p-6 md:p-10">
        <div className="flex divide-x divide-white/15 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          {current.stats.map((s) => (
            <div key={s.label} className="px-5 py-4 text-left md:px-6">
              <p className="font-display text-2xl font-bold text-white md:text-3xl">{s.value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/55">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 right-0 z-10 flex gap-2 p-6 md:p-10">
        {SLIDES.map((s, idx) => (
          <button
            key={s.name}
            type="button"
            aria-label={`Show ${s.name}`}
            onClick={() => setActive(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === active ? 'w-8 bg-white' : 'w-1.5 bg-white/40'}`}
          />
        ))}
      </div>
    </section>
  );
}
