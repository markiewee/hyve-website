import SEO from './SEO';
import FadeIn from './marketing/FadeIn';
import BookingHero from './marketing/BookingHero';
import { lodgingBusinessSchema, orgSchema } from '../lib/seo';
import { BOOKING_URL } from '../lib/booking';
import { track, EVENTS } from '../lib/analytics';
import lentorImg from '../assets/river_valley_exterior.jpg';
import jurongImg from '../assets/modern_condo_exterior.jpg';
import serangoonImg from '../assets/tiong_bahru_neighborhood.jpg';

const onBrowse = (source) => track(EVENTS.BROWSE_ROOMS_CLICK, { source });

function CtaButton({ source, label = 'Browse rooms', className = '' }) {
  return (
    <a
      href={BOOKING_URL}
      onClick={() => onBrowse(source)}
      className={`inline-flex items-center gap-3 bg-accent text-accent-foreground px-12 py-5 font-medium text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all ${className}`}
    >
      {label} <span aria-hidden>→</span>
    </a>
  );
}

const VALUE_PROPS = [
  { n: '01 / Benefits', t: 'All-inclusive', d: 'One monthly price covers rent, utilities and high-speed WiFi — no hidden costs.' },
  { n: '02 / Pricing', t: 'From S$950/mo', d: 'Premium living that stays accessible. No agent fees, ever.' },
  { n: '03 / Transit', t: 'Near MRT', d: 'Every home is picked for its walk to a major MRT line.' },
  { n: '04 / Lease', t: 'Flexible', d: 'Leases from 3 months. No long lock-ins, no complex paperwork.' },
];

const AREAS = [
  { n: 'Location / 01', area: 'Lentor', q: 'lentor', img: lentorImg,
    blurb: 'Quiet residential calm nestled in nature corridors, minutes from the city. Near Lentor & Bright Hill MRT.' },
  { n: 'Location / 02', area: 'Jurong East', q: 'jurong-east', img: jurongImg,
    blurb: "The second CBD — urban convenience at the heart of Singapore's western hub. By the Jurong East MRT interchange." },
  { n: 'Location / 03', area: 'Serangoon', q: 'serangoon', img: serangoonImg,
    blurb: 'A vibrant lifestyle enclave known for its food scene and connectivity. Near the Serangoon MRT interchange.' },
];

const STEPS = [
  { n: 'Step 01', t: 'Browse', d: 'Explore curated rooms with high-fidelity photography and live availability across every home.' },
  { n: 'Step 02', t: 'Reserve', d: 'Lock in your favourite space instantly online. No upfront deposit required to hold your room.' },
  { n: 'Step 03', t: 'Arrival', d: 'Pick up your keys and step into a fully furnished home — ready the moment you are.' },
];

const COMPARISON = [
  { f: 'Starting price', us: 'S$950/mo', them: 'S$1,400/mo' },
  { f: 'Agent fees', us: 'None', them: 'Required' },
  { f: 'Minimum lease', us: 'Flexible (3 mo+)', them: 'Fixed (6 mo+)' },
  { f: 'To reserve', us: 'No deposit', them: '1 mo deposit' },
];

const Eyebrow = ({ children, className = '' }) => (
  <span className={`block text-[11px] uppercase tracking-[0.4em] font-semibold ${className}`}>{children}</span>
);

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <SEO
        title="Co-living in Singapore from S$950/month"
        description="All-inclusive furnished co-living rooms in Singapore — bills included, near MRT in Lentor, Jurong East & Serangoon. No agent fees, flexible 3-month leases."
        canonical="/"
        schema={[orgSchema(), lodgingBusinessSchema()]}
      />

      <BookingHero subtitle="by Lazybee" />

      {/* Value props */}
      <section className="px-6 md:px-20 py-28 md:py-40">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 max-w-screen-2xl mx-auto">
          {VALUE_PROPS.map((v, i) => (
            <FadeIn key={v.t} delay={i * 0.08} className="flex flex-col gap-6">
              <Eyebrow className="text-foreground-variant">{v.n}</Eyebrow>
              <h3 className="font-display font-normal text-3xl leading-tight">{v.t}</h3>
              <p className="text-foreground-variant text-sm leading-relaxed">{v.d}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Property showcase — alternating full-height splits */}
      <section>
        {AREAS.map((a, i) => (
          <div key={a.area} className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} md:h-screen`}>
            <div className="w-full md:w-1/2 h-72 md:h-auto overflow-hidden">
              <img src={a.img} alt={`Lazybee co-living in ${a.area}, Singapore`} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
            </div>
            <div className={`w-full md:w-1/2 flex items-center px-6 md:px-20 py-16 md:py-20 ${i % 2 === 1 ? 'bg-surface' : 'bg-surface-container'}`}>
              <FadeIn className="max-w-md">
                <Eyebrow className="text-accent mb-6">{a.n}</Eyebrow>
                <h3 className="font-display font-light tracking-display text-5xl md:text-6xl mb-8">{a.area}</h3>
                <p className="text-foreground-variant mb-10 leading-relaxed">{a.blurb}</p>
                <a
                  href={`${BOOKING_URL}/?area=${a.q}`}
                  onClick={() => onBrowse(`home_area_${a.q}`)}
                  className="inline-block text-[11px] uppercase tracking-[0.3em] font-semibold text-accent border-b border-accent pb-2 hover:opacity-60 transition-opacity"
                >
                  See rooms here
                </a>
              </FadeIn>
            </div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="px-6 md:px-20 py-28 md:py-40">
        <FadeIn className="text-center mb-20 md:mb-28">
          <Eyebrow className="text-accent mb-6">Process</Eyebrow>
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl">Seamless transition.</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24 max-w-screen-2xl mx-auto">
          {STEPS.map((s, i) => (
            <FadeIn key={s.t} delay={i * 0.08} className="flex flex-col gap-8">
              <Eyebrow className="text-foreground-variant/50">{s.n}</Eyebrow>
              <h3 className="font-display font-normal text-3xl">{s.t}</h3>
              <p className="text-foreground-variant leading-relaxed">{s.d}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Comparison — "The Standard." */}
      <section className="bg-surface px-6 md:px-20 py-28 md:py-40">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="flex flex-col md:flex-row justify-between md:items-end mb-16 md:mb-24 gap-8">
            <h2 className="font-display font-light tracking-display text-5xl md:text-6xl leading-none">The standard.</h2>
            <p className="text-foreground-variant max-w-sm text-sm leading-relaxed">
              Comparing the Lazybee experience with traditional co-living in Singapore.
            </p>
          </FadeIn>
          <FadeIn className="border-t border-border">
            <div className="grid grid-cols-3 py-8 border-b border-border items-center">
              <Eyebrow className="text-foreground-variant/50">Features</Eyebrow>
              <Eyebrow className="text-accent text-center">Lazybee</Eyebrow>
              <Eyebrow className="text-foreground-variant/40 text-center">Typical</Eyebrow>
            </div>
            {COMPARISON.map((r) => (
              <div key={r.f} className="grid grid-cols-3 py-8 border-b border-border/60 items-center">
                <span className="text-sm md:text-base">{r.f}</span>
                <span className="text-center font-medium text-sm md:text-base">{r.us}</span>
                <span className="text-center text-foreground-variant/50 text-sm md:text-base">{r.them}</span>
              </div>
            ))}
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative min-h-[70vh] flex items-center justify-center bg-surface-container px-6 py-28">
        <FadeIn className="relative z-10 text-center max-w-3xl">
          <h2 className="font-display font-light tracking-display text-5xl md:text-7xl mb-12">Begin your journey.</h2>
          <div className="flex justify-center">
            <CtaButton source="home_final" label="View available rooms" />
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
