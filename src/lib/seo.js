// src/lib/seo.js, pure JSON-LD builders. No side effects.
//
// Every number and address in here is grounded in src/data/lazybeeRooms.js, which
// is a live pull from hyve-iot. There are deliberately no aggregateRating and no
// review counts: we do not have real ones, and inventing them is the fastest way
// to get structured data ignored or penalised.
import { HOMES, ROOMS } from '../data/lazybeeRooms.js';

const BASE = 'https://www.lazybee.sg';
const BRAND = 'Lazybee';
const LEGAL_NAME = 'Makery Pte. Ltd.';
const PHONE = '+6580695410';
const EMAIL = 'hello@lazybee.sg';
const SAME_AS = ['https://wa.me/6580695410', 'https://www.instagram.com/lazybee.sg'];

const rents = ROOMS.map((r) => r.price).filter((p) => typeof p === 'number' && p > 0);
const RENT_MIN = rents.length ? Math.min(...rents) : null;
const RENT_MAX = rents.length ? Math.max(...rents) : null;
const PRICE_RANGE =
  RENT_MIN && RENT_MAX
    ? `S$${RENT_MIN.toLocaleString('en-SG')} to S$${RENT_MAX.toLocaleString('en-SG')} per month`
    : undefined;

/** Areas as a person would search for them, taken from each home's nearest MRT. */
const AREAS = [...new Set(HOMES.map((h) => h.mrt?.station).filter(Boolean))];

/** "#04-03, 135 Serangoon Avenue 3, Singapore 556114" split into a PostalAddress. */
function postalAddress(address) {
  const postal = (address.match(/Singapore\s+(\d{6})/) || [])[1];
  const street = address.replace(/,?\s*Singapore\s+\d{6}\s*$/, '').trim();
  return {
    '@type': 'PostalAddress',
    streetAddress: street,
    addressLocality: 'Singapore',
    addressCountry: 'SG',
    ...(postal ? { postalCode: postal } : {}),
  };
}

export function orgSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE}/#organization`,
    name: BRAND,
    legalName: LEGAL_NAME,
    url: BASE,
    logo: `${BASE}/lazybee-logo.png`,
    image: `${BASE}/og-default.png`,
    description:
      'Lazybee is a Singapore co-living operator, run by Makery Pte. Ltd. It master-leases whole ' +
      'condominium units from owners, furnishes and manages them, and rents the rooms out ' +
      'all-inclusive to residents.',
    telephone: PHONE,
    email: EMAIL,
    areaServed: { '@type': 'Country', name: 'Singapore' },
    sameAs: SAME_AS,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: PHONE,
      email: EMAIL,
      areaServed: 'SG',
      availableLanguage: ['en', 'zh'],
    },
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE}/#website`,
    url: BASE,
    name: BRAND,
    publisher: { '@id': `${BASE}/#organization` },
    inLanguage: 'en-SG',
  };
}

/**
 * One LocalBusiness node per home, with its real street address.
 *
 * Three separate nodes rather than one, because Lazybee has three physical places
 * and a single LocalBusiness would have to either invent a head-office address or
 * pick one home and pretend it is all of them.
 */
export function localBusinessSchemas() {
  return HOMES.map((home) => ({
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'LodgingBusiness'],
    '@id': `${BASE}/#home-${home.slug}`,
    name: `${BRAND} ${home.name}`,
    parentOrganization: { '@id': `${BASE}/#organization` },
    url: BASE,
    image: `${BASE}/og-default.png`,
    telephone: PHONE,
    email: EMAIL,
    ...(PRICE_RANGE ? { priceRange: PRICE_RANGE } : {}),
    currenciesAccepted: 'SGD',
    address: postalAddress(home.address),
    ...(Array.isArray(home.ll)
      ? { geo: { '@type': 'GeoCoordinates', longitude: home.ll[0], latitude: home.ll[1] } }
      : {}),
    ...(home.mrt?.station
      ? {
          publicAccess: true,
          description:
            `Managed co-living rooms at ${home.full}, about ` +
            `${home.mrt.walking_minutes} minutes' walk from ${home.mrt.station} MRT.`,
        }
      : {}),
    areaServed: AREAS,
    sameAs: SAME_AS,
  }));
}

/* ── the rooms themselves ─────────────────────────────────────────── */

/** Rooms only. Kitchens, toilets, yards and common areas are not lettable. */
const LETTABLE = ROOMS.filter((r) => r.code && r.price > 0);

const BOOKING = 'https://book.lazybee.sg';
const homeOf = (code) => HOMES.find((h) => h.code === code);

/**
 * One room as schema.org Accommodation.
 *
 * There is no `availability` and no `availabilityStarts` on the offer, on
 * purpose. Everything else in here is a stable fact that only changes when
 * somebody edits the inventory, but availability changes when a person
 * signs or moves out, which is not a deploy. Stating it from a build-time
 * snapshot is how an ad ends up selling a room that is already taken, so
 * the offer links to the booking page and lets the live system answer.
 */
export function accommodationSchema(room) {
  const home = homeOf(room.home);
  const url = `${BOOKING}/rooms/${room.code}`;
  const amenities = Array.isArray(room.am) ? room.am : [];
  const photos = Array.isArray(room.photos) ? room.photos : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    '@id': url,
    url,
    identifier: room.ref || room.code,
    name: home ? `${room.type} at ${home.name}` : room.type,
    accommodationCategory: room.type,
    ...(photos.length ? { image: photos.map((src) => `${BASE}${src}`) } : {}),
    ...(room.sqm
      ? { floorSize: { '@type': 'QuantitativeValue', value: room.sqm, unitCode: 'MTK' } }
      : {}),
    ...(room.occ
      ? {
          occupancy: {
            '@type': 'QuantitativeValue',
            maxValue: room.occ,
            unitText: 'person',
          },
        }
      : {}),
    ...(room.bed
      ? { bed: { '@type': 'BedDetails', typeOfBed: room.bed, numberOfBeds: 1 } }
      : {}),
    ...(room.ensuite ? { numberOfBathroomsTotal: 1 } : {}),
    ...(amenities.length
      ? {
          amenityFeature: amenities.map((name) => ({
            '@type': 'LocationFeatureSpecification',
            name,
            value: true,
          })),
        }
      : {}),
    ...(home
      ? {
          containedInPlace: {
            '@type': 'ApartmentComplex',
            name: home.full,
            address: postalAddress(home.address),
            ...(Array.isArray(home.ll)
              ? {
                  geo: {
                    '@type': 'GeoCoordinates',
                    longitude: home.ll[0],
                    latitude: home.ll[1],
                  },
                }
              : {}),
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'SGD',
      /* goodrelations LeaseOut, because this is a tenancy and not a sale. */
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: room.price,
        priceCurrency: 'SGD',
        unitCode: 'MON',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
      ...(room.min
        ? {
            eligibleDuration: {
              '@type': 'QuantitativeValue',
              minValue: room.min,
              unitCode: 'MON',
            },
          }
        : {}),
      seller: { '@id': `${BASE}/#organization` },
    },
  };
}

/** Every lettable room, in one list, for the page that shows the comb. */
export function roomListSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${BASE}/#rooms`,
    name: `${BRAND} rooms`,
    numberOfItems: LETTABLE.length,
    itemListElement: LETTABLE.map((room, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: accommodationSchema(room),
    })),
  };
}

/** Legacy single-node builder, kept for the retired /locations route. */
export function lodgingBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: BRAND,
    legalName: LEGAL_NAME,
    url: BASE,
    image: `${BASE}/og-default.png`,
    telephone: PHONE,
    email: EMAIL,
    ...(PRICE_RANGE ? { priceRange: PRICE_RANGE } : {}),
    address: { '@type': 'PostalAddress', addressLocality: 'Singapore', addressCountry: 'SG' },
    areaServed: AREAS,
    sameAs: SAME_AS,
  };
}

export { RENT_MIN, RENT_MAX, PRICE_RANGE, AREAS, LEGAL_NAME };

export function faqPageSchema(qas) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map((qa) => ({
      '@type': 'Question',
      name: qa.q,
      acceptedAnswer: { '@type': 'Answer', text: qa.a },
    })),
  };
}

export function blogPostingSchema(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || '',
    datePublished: post.publishedAt || post.date || undefined,
    image: post.coverImage || `${BASE}/og-default.png`,
    author: { '@type': 'Organization', name: BRAND },
    publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: `${BASE}/lazybee-logo.png` } },
    mainEntityOfPage: `${BASE}/blog/${post.slug}`,
  };
}

export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${BASE}${it.path}`,
    })),
  };
}
