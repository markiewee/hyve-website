import SEO from './SEO';
import { lodgingBusinessSchema, breadcrumbSchema } from '../lib/seo';
import FadeIn from './marketing/FadeIn';
import BrowseRoomsButton from './marketing/BrowseRoomsButton';
import CtaBand from './marketing/CtaBand';
import { BOOKING_URL } from '../lib/booking';

const AREAS = [
  {
    name: 'Lentor',
    slug: 'lentor',
    mrt: 'Near Lentor MRT (Thomson-East Coast Line) and Bright Hill MRT.',
    blurb:
      'Quiet, leafy and residential — Lentor sits in one of Singapore\'s most sought-after new-growth corridors. Nature trails, parks and the brand-new Lentor Modern mall are all within walking distance.',
  },
  {
    name: 'Jurong East',
    slug: 'jurong-east',
    mrt: 'Near Jurong East MRT interchange (East-West & North-South Lines).',
    blurb:
      'The commercial heart of the west — JEM, Westgate and IMM malls plus major employers are minutes away. A well-connected interchange makes the rest of the island easy to reach.',
  },
  {
    name: 'Serangoon',
    slug: 'serangoon',
    mrt: 'Near Serangoon MRT interchange (North-East & Circle Lines).',
    blurb:
      'Northeast heartland charm at its best — hawker centres, NEX mall and a vibrant food scene sit right on your doorstep, with two MRT lines keeping every corner of Singapore close.',
  },
];

const LocationsPage = () => {
  return (
    <main className="bg-background text-foreground pt-24 md:pt-28">
      <SEO
        title="Co-living locations in Singapore"
        description="Lazybee co-living in Lentor, Jurong East and Serangoon — all near MRT. Browse rooms by area."
        canonical="/locations"
        schema={[
          lodgingBusinessSchema(),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Locations', path: '/locations' },
          ]),
        ]}
      />

      {/* Page header */}
      <section className="max-w-4xl mx-auto px-6 py-16 md:py-24 text-center">
        <FadeIn>
          <h1 className="font-display tracking-display text-4xl md:text-6xl font-bold mb-6">
            Where Lazybee lives
          </h1>
          <p className="text-foreground-variant text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Three neighbourhoods across Singapore — all near MRT, all fully
            furnished, all ready to move into.
          </p>
        </FadeIn>
      </section>

      {/* Area cards grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {AREAS.map((area) => (
            <FadeIn key={area.slug}>
              <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col h-full">
                <h2 className="font-display font-bold text-2xl mb-2">
                  {area.name}
                </h2>
                <p className="text-accent text-sm font-medium mb-4">
                  {area.mrt}
                </p>
                <p className="text-foreground-variant text-sm leading-relaxed flex-1">
                  {area.blurb}
                </p>
                <BrowseRoomsButton
                  source={`locations_${area.slug}`}
                  label="See rooms here →"
                  href={`${BOOKING_URL}/?area=${area.slug}`}
                  className="text-sm px-5 py-2 mt-4"
                />
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA footer band */}
      <CtaBand source="locations_footer" />
    </main>
  );
};

export default LocationsPage;
