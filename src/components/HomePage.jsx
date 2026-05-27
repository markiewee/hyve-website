import SEO from './SEO';
import FadeIn from './marketing/FadeIn';
import BrowseRoomsButton from './marketing/BrowseRoomsButton';
import CtaBand from './marketing/CtaBand';
import { lodgingBusinessSchema, orgSchema } from '../lib/seo';
import { BOOKING_URL } from '../lib/booking';
import heroImg from '../assets/hero_coliving_interior.jpg';

const VALUE_PROPS = [
  { t: 'All-inclusive', d: 'One monthly payment — rent, utilities, WiFi, weekly cleaning.' },
  { t: 'From S$950/mo', d: 'Fully furnished private rooms. No agent fees.' },
  { t: 'Near MRT', d: 'Lentor, Jurong East & Serangoon — all a short walk from the train.' },
  { t: 'Flexible', d: 'Leases from 3 months. No 12-month lock-in.' },
];
const STEPS = [
  { n: '1', t: 'Browse', d: 'See live availability across all our homes.' },
  { n: '2', t: 'Reserve — no deposit', d: 'Hold your room instantly, no money down.' },
  { n: '3', t: 'Move in', d: 'Sign online, pay, get your keys.' },
];
const AREAS = [
  { area: 'Lentor', blurb: 'Quiet, leafy, near Lentor & Bright Hill MRT.', q: 'lentor' },
  { area: 'Jurong East', blurb: 'West-side hub, malls and MRT interchange minutes away.', q: 'jurong-east' },
  { area: 'Serangoon', blurb: 'Northeast heartland charm, near Serangoon MRT.', q: 'serangoon' },
];

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <SEO
        title="Co-living in Singapore from S$950/month"
        description="All-inclusive furnished co-living rooms in Singapore — bills included, near MRT in Lentor, Jurong East & Serangoon. No agent fees, flexible 3-month leases."
        canonical="/"
        schema={[orgSchema(), lodgingBusinessSchema()]}
      />

      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="A bright, furnished Lazybee co-living common area in Singapore" className="w-full h-full object-cover kenburns" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/30 to-background" />
        </div>
        <div className="relative max-w-screen-2xl mx-auto px-6 md:px-8 pb-20 w-full">
          <FadeIn>
            <h1 className="font-display tracking-display text-5xl md:text-7xl font-extrabold max-w-3xl">
              Co-living in Singapore, all bills in.
            </h1>
            <p className="text-foreground-variant text-lg md:text-xl mt-6 max-w-xl">
              Fully furnished rooms from S$950/month. Near MRT. No agent fees. Reserve online — no deposit to hold.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <BrowseRoomsButton source="home_hero" />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-screen-2xl mx-auto px-6 md:px-8 py-16 grid grid-cols-2 md:grid-cols-4 gap-6">
        {VALUE_PROPS.map((v, i) => (
          <FadeIn key={v.t} delay={i * 0.05}>
            <div className="bg-surface rounded-2xl border border-border p-6 h-full">
              <h3 className="font-display font-bold text-xl mb-2">{v.t}</h3>
              <p className="text-foreground-variant text-sm">{v.d}</p>
            </div>
          </FadeIn>
        ))}
      </section>

      {/* How it works */}
      <section className="bg-surface py-20">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
          <FadeIn><h2 className="font-display tracking-display text-3xl md:text-4xl font-bold mb-12">How it works</h2></FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.08}>
                <div className="flex gap-4">
                  <span className="font-display text-accent text-4xl font-extrabold">{s.n}</span>
                  <div><h3 className="font-display font-bold text-xl">{s.t}</h3><p className="text-foreground-variant mt-1">{s.d}</p></div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Neighbourhood highlights — area level, links into booking site */}
      <section className="max-w-screen-2xl mx-auto px-6 md:px-8 py-20">
        <FadeIn><h2 className="font-display tracking-display text-3xl md:text-4xl font-bold mb-12">Where we are</h2></FadeIn>
        <div className="grid md:grid-cols-3 gap-6">
          {AREAS.map((n) => (
            <FadeIn key={n.area}>
              <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                <div className="p-6">
                  <h3 className="font-display font-bold text-2xl">{n.area}</h3>
                  <p className="text-foreground-variant mt-2 mb-4">{n.blurb}</p>
                  <BrowseRoomsButton source={`home_area_${n.q}`} label="See rooms here →" href={`${BOOKING_URL}/?area=${n.q}`} className="text-sm px-5 py-2" />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Comparison table — keep accurate; strong SEO/AEO asset */}
      <section className="bg-surface py-20">
        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <FadeIn><h2 className="font-display tracking-display text-3xl md:text-4xl font-bold mb-8">Lazybee vs other co-living</h2></FadeIn>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left">
              <thead className="bg-surface-container">
                <tr><th className="p-4 font-display">&nbsp;</th><th className="p-4 font-display text-accent">Lazybee</th><th className="p-4 font-display text-foreground-variant">Typical co-living</th></tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                <tr><td className="p-4 font-semibold">Starting price</td><td className="p-4">S$950/mo, all-inclusive</td><td className="p-4 text-foreground-variant">S$1,200–2,500+ before extras</td></tr>
                <tr><td className="p-4 font-semibold">Agent fees</td><td className="p-4">None</td><td className="p-4 text-foreground-variant">Often half a month</td></tr>
                <tr><td className="p-4 font-semibold">Minimum lease</td><td className="p-4">3 months</td><td className="p-4 text-foreground-variant">6–12 months</td></tr>
                <tr><td className="p-4 font-semibold">To reserve</td><td className="p-4">Online, no deposit to hold</td><td className="p-4 text-foreground-variant">Deposit up front</td></tr>
                <tr><td className="p-4 font-semibold">Utilities included</td><td className="p-4">Yes — electricity, water, gas, WiFi</td><td className="p-4 text-foreground-variant">Often separate</td></tr>
                <tr><td className="p-4 font-semibold">Furnished</td><td className="p-4">Fully furnished, premium finishes</td><td className="p-4 text-foreground-variant">Varies</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="max-w-3xl mx-auto px-6 md:px-8 py-20 text-center">
        <FadeIn>
          <h2 className="font-display tracking-display text-3xl font-bold mb-4">Questions?</h2>
          <p className="text-foreground-variant mb-6">How co-living works, what's included, lease terms and more.</p>
          <a href="/faqs" className="text-accent font-display font-semibold hover:underline">Read the FAQs →</a>
        </FadeIn>
      </section>

      <CtaBand source="home_footer" />
    </main>
  );
}
