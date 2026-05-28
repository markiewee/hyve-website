import SEO from './SEO';
import FadeIn from './marketing/FadeIn';
import { lodgingBusinessSchema, orgSchema } from '../lib/seo';
import { BOOKING_URL } from '../lib/booking';
import { track, EVENTS } from '../lib/analytics';
import heroImg from '../assets/hero_coliving_interior.jpg';

const cpImg = '/photos/cp-hero.jpg';
const tgImg = '/photos/tg-hero.jpg';
const ihImg = '/photos/ih-hero.jpg';

const DECK_MAILTO =
  'mailto:mark@meetmillia.com?subject=Lazybee%20—%20Investor%20deck%20request&body=Hi%20Mark%2C%0A%0AI%27d%20like%20to%20see%20the%20Lazybee%20investor%20deck.%0A%0AName%3A%0AFirm%2FBackground%3A%0ATicket%20size%20%2F%20interest%3A%0A%0AThanks';

const onDeck = (source) => track(EVENTS.BROWSE_ROOMS_CLICK, { source, intent: 'deck_request' });

function PrimaryCta({ label = 'Request the deck', source, href = DECK_MAILTO, className = '' }) {
  return (
    <a
      href={href}
      onClick={() => onDeck(source)}
      className={`inline-flex items-center gap-3 bg-accent text-accent-foreground px-12 py-5 font-medium text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all ${className}`}
    >
      {label} <span aria-hidden>→</span>
    </a>
  );
}

function SecondaryCta({ label, source, href, className = '' }) {
  return (
    <a
      href={href}
      onClick={() => onDeck(source)}
      className={`inline-flex items-center gap-3 border border-foreground/30 text-foreground px-10 py-5 font-medium text-xs uppercase tracking-[0.3em] hover:bg-foreground/5 active:scale-95 transition-all ${className}`}
    >
      {label} <span aria-hidden>→</span>
    </a>
  );
}

const Eyebrow = ({ children, className = '' }) => (
  <span className={`block text-[11px] uppercase tracking-[0.4em] font-semibold ${className}`}>{children}</span>
);

const TRACTION = [
  { v: '3', l: 'Properties live' },
  { v: '18', l: 'Rooms' },
  { v: '100%', l: 'Trailing occupancy' },
  { v: 'SG', l: 'Singapore' },
];

const THESIS = [
  {
    n: '01 / Demand',
    t: 'Chronic shortage.',
    d: 'Singapore adds 25k+ working residents a year while home-ownership timelines stretch. Shared-room demand keeps compounding, year after year.',
  },
  {
    n: '02 / Gap',
    t: 'Legacy is broken.',
    d: 'Traditional rentals are agent-heavy, rigid, and bare. Serviced apartments are 3× the price. There is no productized middle.',
  },
  {
    n: '03 / Product',
    t: 'Same room, every home.',
    d: 'Every Lazybee unit is fitted, photographed, and operated to the same SOP. We run a brand, not a portfolio of mismatched flats.',
  },
  {
    n: '04 / Tech',
    t: 'Leakage-proof ops.',
    d: 'In-house platform handles leasing, billing, maintenance and occupancy end-to-end. No spreadsheet cliff as we add rooms.',
  },
];

const PORTFOLIO = [
  {
    n: 'Property / 01',
    name: 'Chiltern Park',
    img: cpImg,
    blurb: 'Six rooms in a quiet enclave near the city. Strong long-stay demand from working professionals.',
    stats: [
      { v: '6', l: 'Rooms' },
      { v: '100%', l: 'Occupancy' },
      { v: 'CBD-adjacent', l: 'Location' },
    ],
  },
  {
    n: 'Property / 02',
    name: 'Thomson Grove',
    img: tgImg,
    blurb: 'Six rooms beside Lentor and Bright Hill MRT. Lifestyle district with nature corridors at the doorstep.',
    stats: [
      { v: '6', l: 'Rooms' },
      { v: '100%', l: 'Occupancy' },
      { v: 'Lentor', l: 'District' },
    ],
  },
  {
    n: 'Property / 03',
    name: 'Ivory Heights',
    img: ihImg,
    blurb: 'Seven rooms at the Jurong East interchange — Singapore\'s second CBD, with the largest commuter catchment outside city centre.',
    stats: [
      { v: '7', l: 'Rooms' },
      { v: '100%', l: 'Occupancy' },
      { v: 'Jurong East', l: 'District' },
    ],
  },
];

const ECONOMICS = [
  { f: 'Operating model', v: 'Master-lease arbitrage' },
  { f: 'Avg ticket / room', v: 'S$950 – 1,500 / mo' },
  { f: 'Avg lease length', v: '6 – 12 months' },
  { f: 'Turnover handling', v: 'In-house captains, no agents' },
  { f: 'Tech stack', v: 'Built in-house — leasing, billing, IoT' },
];

const PIPELINE = [
  { t: 'Next 6 months', d: 'Two new properties under negotiation — Lentor and Serangoon. Targeting +12 rooms by Q4.' },
  { t: 'Next 18 months', d: 'Push toward 50+ rooms across five properties. Crossover to positive group EBITDA on current cost structure.' },
  { t: 'Beyond', d: 'Replicate the playbook in a second SE-Asia metro. Leverage the platform, not just the units.' },
];

const TEAM = [
  { name: 'Mark Wee', role: 'Founder & CEO', bio: 'Operator-founder, building Lazybee + the platform that runs it. Previously product + ops across consumer and prop-tech.' },
  { name: 'Jason Park', role: 'Co-founder', bio: 'Co-owner driving the broader Millia group strategy and Lazybee growth.' },
];

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <SEO
        title="Lazybee — Co-living, productized. An investable Singapore operator."
        description="Lazybee is a Singapore co-living operator running a productized portfolio of shared homes — same fit, same SOP, same brand across every unit. For investors and partners."
        canonical="/"
        schema={[orgSchema(), lodgingBusinessSchema()]}
      />

      {/* Hero — investor thesis */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Lazybee co-living interior" className="w-full h-full object-cover kenburns" />
          <div className="absolute inset-0 bg-background/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        </div>
        <FadeIn className="relative z-10 max-w-5xl px-6 md:px-20 py-32 md:py-40">
          <Eyebrow className="text-accent mb-8">Lazybee · As an investment</Eyebrow>
          <h1 className="font-display font-bold tracking-display leading-[0.95] text-5xl md:text-7xl lg:text-8xl mb-10">
            Co-living, productized.
          </h1>
          <p className="font-light text-foreground-variant text-lg md:text-xl max-w-2xl mb-14 leading-relaxed">
            Singapore's modern shared homes — designed, leased, and operated as a single product.
            Built for residents. Structured for investors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <PrimaryCta source="hero" />
            <SecondaryCta label="Talk to the founders" source="hero" href="mailto:mark@meetmillia.com?subject=Lazybee%20—%20Investor%20intro" />
          </div>

          {/* Traction strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-8 pt-12 border-t border-border/60 max-w-3xl">
            {TRACTION.map((s) => (
              <div key={s.l}>
                <p className="font-display text-3xl md:text-4xl font-bold tracking-display">{s.v}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-foreground-variant">{s.l}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Thesis */}
      <section className="px-6 md:px-20 py-28 md:py-40">
        <FadeIn className="max-w-screen-2xl mx-auto mb-20 md:mb-28">
          <Eyebrow className="text-accent mb-6">Thesis</Eyebrow>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl leading-none max-w-3xl">
            Why this works.
          </h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-16 max-w-screen-2xl mx-auto">
          {THESIS.map((v, i) => (
            <FadeIn key={v.t} delay={i * 0.08} className="flex flex-col gap-6">
              <Eyebrow className="text-foreground-variant">{v.n}</Eyebrow>
              <h3 className="font-display font-normal text-3xl leading-tight">{v.t}</h3>
              <p className="text-foreground-variant text-sm leading-relaxed">{v.d}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Portfolio */}
      <section>
        {PORTFOLIO.map((p, i) => (
          <div key={p.name} className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} md:h-screen`}>
            <div className="w-full md:w-1/2 h-72 md:h-auto overflow-hidden">
              <img src={p.img} alt={`${p.name} — Lazybee co-living`} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
            </div>
            <div className={`w-full md:w-1/2 flex items-center px-6 md:px-20 py-20 ${i % 2 === 1 ? 'bg-surface' : 'bg-surface-container'}`}>
              <FadeIn className="max-w-lg">
                <Eyebrow className="text-accent mb-6">{p.n}</Eyebrow>
                <h3 className="font-display font-light tracking-display text-5xl md:text-6xl mb-8">{p.name}</h3>
                <p className="text-foreground-variant mb-10 leading-relaxed">{p.blurb}</p>
                <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border/60">
                  {p.stats.map((s) => (
                    <div key={s.l}>
                      <p className="font-display font-bold text-2xl">{s.v}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-foreground-variant">{s.l}</p>
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>
          </div>
        ))}
      </section>

      {/* Unit economics */}
      <section className="bg-surface px-6 md:px-20 py-28 md:py-40">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="flex flex-col md:flex-row justify-between md:items-end mb-16 md:mb-24 gap-8">
            <h2 className="font-display font-light tracking-display text-5xl md:text-6xl leading-none">The model.</h2>
            <p className="text-foreground-variant max-w-sm text-sm leading-relaxed">
              How Lazybee turns master leases into a defensible, scalable operating business.
            </p>
          </FadeIn>
          <FadeIn className="border-t border-border">
            {ECONOMICS.map((r) => (
              <div key={r.f} className="grid grid-cols-1 md:grid-cols-2 py-8 border-b border-border/60 gap-3">
                <Eyebrow className="text-foreground-variant/70 md:pt-1">{r.f}</Eyebrow>
                <span className="text-base md:text-lg">{r.v}</span>
              </div>
            ))}
          </FadeIn>
        </div>
      </section>

      {/* Pipeline */}
      <section className="px-6 md:px-20 py-28 md:py-40">
        <FadeIn className="max-w-screen-2xl mx-auto mb-20 md:mb-28">
          <Eyebrow className="text-accent mb-6">Roadmap</Eyebrow>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl leading-none">What's next.</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24 max-w-screen-2xl mx-auto">
          {PIPELINE.map((s, i) => (
            <FadeIn key={s.t} delay={i * 0.08} className="flex flex-col gap-8">
              <Eyebrow className="text-foreground-variant/60">{s.t}</Eyebrow>
              <p className="text-foreground-variant leading-relaxed text-base md:text-lg">{s.d}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="bg-surface-container px-6 md:px-20 py-28 md:py-40">
        <FadeIn className="max-w-screen-2xl mx-auto mb-20 md:mb-28">
          <Eyebrow className="text-accent mb-6">Team</Eyebrow>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl leading-none">Who's building it.</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 max-w-5xl mx-auto">
          {TEAM.map((m, i) => (
            <FadeIn key={m.name} delay={i * 0.08} className="flex flex-col gap-6">
              <h3 className="font-display font-normal text-4xl">{m.name}</h3>
              <Eyebrow className="text-accent">{m.role}</Eyebrow>
              <p className="text-foreground-variant leading-relaxed">{m.bio}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative min-h-[70vh] flex items-center justify-center px-6 py-28 bg-background">
        <FadeIn className="relative z-10 text-center max-w-3xl">
          <Eyebrow className="text-accent mb-8">Get involved</Eyebrow>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl mb-10 leading-none">Let's talk.</h2>
          <p className="text-foreground-variant text-lg leading-relaxed mb-12 max-w-xl mx-auto">
            We share the deck, financials, and pipeline detail under NDA. Send a short note and we'll come back the same week.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <PrimaryCta source="final" />
            <SecondaryCta label="Schedule a call" source="final" href="mailto:mark@meetmillia.com?subject=Lazybee%20—%20Investor%20call" />
          </div>
          <p className="mt-16 text-xs text-foreground-variant/50 tracking-wider">
            Looking for a room?{' '}
            <a href={BOOKING_URL} className="text-accent hover:underline">book.lazybee.sg</a>
          </p>
        </FadeIn>
      </section>
    </main>
  );
}
