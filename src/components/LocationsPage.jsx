import SEO from './SEO';
import { lodgingBusinessSchema, breadcrumbSchema } from '../lib/seo';
import FadeIn from './marketing/FadeIn';

// One job: show the footprint is real and expanding.

const AREAS = [
  {
    name: 'Lentor',
    property: 'Thomson Grove',
    rooms: 6,
    mrt: 'Lentor MRT (TEL) & Bright Hill MRT',
    blurb:
      'A leafy, sought-after new-growth corridor. Nature trails, parks and Lentor Modern within walking distance — strong long-stay demand from professionals.',
  },
  {
    name: 'Jurong East',
    property: 'Ivory Heights',
    rooms: 7,
    mrt: 'Jurong East interchange (EWL & NSL)',
    blurb:
      "Singapore's second CBD — JEM, Westgate, IMM and major employers minutes away. The largest commuter catchment outside the city centre.",
  },
  {
    name: 'Serangoon',
    property: 'Chiltern Park',
    rooms: 6,
    mrt: 'Serangoon interchange (NEL & CCL)',
    blurb:
      'Northeast heartland at its best — NEX mall, hawker culture and two MRT lines on the doorstep. Deep, stable tenant demand year-round.',
  },
];

const LocationsPage = () => {
  return (
    <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen">
      <SEO
        title="Where Lazybee operates — Singapore"
        description="Lazybee runs managed co-living in Lentor, Jurong East and Serangoon — all near MRT interchanges, chosen for rental demand. A real, expanding footprint."
        canonical="/locations"
        schema={[
          lodgingBusinessSchema(),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Locations', path: '/locations' },
          ]),
        ]}
      />

      {/* Header */}
      <section className="max-w-4xl mx-auto px-6 py-16 md:py-24 text-center">
        <FadeIn>
          <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-6">Footprint</span>
          <h1 className="font-display tracking-display text-4xl md:text-6xl font-bold mb-6">
            Where Lazybee operates
          </h1>
          <p className="text-foreground-variant text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Three live properties across Singapore — each chosen for MRT access and rental demand.
            Two more under negotiation.
          </p>
        </FadeIn>
      </section>

      {/* Area cards */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {AREAS.map((area) => (
            <FadeIn key={area.property}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 flex flex-col h-full">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="font-display font-bold text-2xl">{area.name}</h2>
                  <span className="font-display font-bold text-accent text-lg">{area.rooms} <span className="text-xs uppercase tracking-wider text-foreground-variant">rooms</span></span>
                </div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-variant mb-1">{area.property}</p>
                <p className="text-accent text-sm font-medium mb-5">{area.mrt}</p>
                <p className="text-foreground-variant text-sm leading-relaxed flex-1">{area.blurb}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Close: landlord / investor ask */}
      <section className="px-6 pb-28 md:pb-40">
        <FadeIn className="max-w-3xl mx-auto text-center rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-10 md:p-14">
          <h2 className="font-display tracking-display text-3xl md:text-4xl font-bold mb-4">Have a unit in one of these areas?</h2>
          <p className="text-foreground-variant mb-8 max-w-xl mx-auto">
            We're actively taking on units near these MRT interchanges. List yours for a guaranteed, fully-managed lease.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-3 rounded-full bg-accent text-accent-foreground px-10 py-4 font-semibold text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all"
          >
            List your unit <span aria-hidden>→</span>
          </a>
        </FadeIn>
      </section>
    </main>
  );
};

export default LocationsPage;
