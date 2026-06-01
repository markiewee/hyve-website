import SEO from './SEO';
import FadeIn from './marketing/FadeIn';
import ReturnsEstimator from './marketing/ReturnsEstimator';
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

const Eyebrow = ({ children, className = '' }) => (
  <span className={`block text-[11px] uppercase tracking-[0.4em] font-semibold ${className}`}>{children}</span>
);

// One job: make an investor want the deck.
// Everything below earns that one click — nothing else.

const TRACTION = [
  { v: '3', l: 'Properties live' },
  { v: '18', l: 'Rooms' },
  { v: '100%', l: 'Trailing occupancy' },
  { v: 'SG', l: 'Singapore' },
];

const PORTFOLIO = [
  { name: 'Chiltern Park', img: cpImg, meta: '6 rooms · CBD-adjacent' },
  { name: 'Thomson Grove', img: tgImg, meta: '6 rooms · Lentor' },
  { name: 'Ivory Heights', img: ihImg, meta: '7 rooms · Jurong East' },
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

      {/* ── Hero: the hook + one CTA ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Lazybee co-living interior" className="w-full h-full object-cover kenburns" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
        </div>
        <FadeIn className="relative z-10 max-w-5xl px-6 md:px-20 py-32 md:py-40">
          <Eyebrow className="text-accent mb-8">Lazybee · As an investment</Eyebrow>
          <h1 className="font-display font-bold tracking-display leading-[0.95] text-5xl md:text-7xl lg:text-8xl mb-10">
            Co-living, productized.
          </h1>
          <p className="font-light text-foreground-variant text-lg md:text-xl max-w-2xl mb-14 leading-relaxed">
            Singapore's shared homes — designed, leased, and operated as a single product.
            Three properties, full occupancy, built on our own platform.
          </p>

          <a
            href={DECK_MAILTO}
            onClick={() => onDeck('hero')}
            className="inline-flex items-center gap-3 rounded-full bg-accent text-accent-foreground px-12 py-5 font-semibold text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all"
          >
            Request the deck <span aria-hidden>→</span>
          </a>

          {/* The single proof point: traction at a glance */}
          <div className="mt-16 inline-flex rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl divide-x divide-white/10">
            {TRACTION.map((s) => (
              <div key={s.l} className="px-6 py-5 md:px-8 md:py-6">
                <p className="font-display text-2xl md:text-3xl font-bold tracking-display text-white">{s.v}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/60">{s.l}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── Proof the assets are real: portfolio triptych ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {PORTFOLIO.map((p) => (
          <div key={p.name} className="relative h-[55vh] md:h-screen overflow-hidden group">
            <img
              src={p.img}
              alt={`${p.name} — Lazybee co-living`}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/40" />
            <div className="absolute bottom-0 left-0 p-8 md:p-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-2">{p.meta}</p>
              <h3 className="font-display font-bold tracking-display text-3xl md:text-4xl text-white">{p.name}</h3>
            </div>
          </div>
        ))}
      </section>

      {/* ── The hook: estimate returns from a postal code ── */}
      <ReturnsEstimator />

      {/* ── Close: the same one ask ── */}
      <section className="px-6 py-28 md:py-44 bg-background">
        <FadeIn className="text-center max-w-3xl mx-auto">
          <Eyebrow className="text-accent mb-8">Get involved</Eyebrow>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl mb-10 leading-none">
            See the numbers.
          </h2>
          <p className="text-foreground-variant text-lg leading-relaxed mb-12 max-w-xl mx-auto">
            The deck, financials, and pipeline — shared under NDA. Send a short note and we'll come back the same week.
          </p>
          <a
            href={DECK_MAILTO}
            onClick={() => onDeck('final')}
            className="inline-flex items-center gap-3 rounded-full bg-accent text-accent-foreground px-12 py-5 font-semibold text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all"
          >
            Request the deck <span aria-hidden>→</span>
          </a>
          <p className="mt-16 text-xs text-foreground-variant/50 tracking-wider">
            Looking for a room?{' '}
            <a href={BOOKING_URL} className="text-accent hover:underline">book.lazybee.sg</a>
          </p>
        </FadeIn>
      </section>
    </main>
  );
}
