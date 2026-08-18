// src/lib/siteMeta.js
//
// The single source of truth for what goes in the <head> of every indexable page.
//
// This is a plain data map rather than a React component on purpose. The metadata
// has to end up in the raw HTML that a non-rendering crawler reads (GPTBot,
// ClaudeBot, PerplexityBot and friends do not run JavaScript), and the prerender
// step writes it directly. A runtime library can silently stop applying tags,
// which is exactly what happened here with react-helmet-async on React 19: the
// <SEO> component still renders, but nothing it declares reaches the document.
// A data map cannot fail that way, because the build reads it and the bytes on
// disk are the proof.
//
// Every fact below is grounded: prices come from src/data/lazybeeRooms.js (pulled
// live from hyve-iot), addresses from the same file. Nothing is invented, and there
// are deliberately no ratings or review counts because we do not have real ones.

import { HIVE_ROUTES, HIVE_ROUTE_META } from './hiveRoutes.js';
import { hasTestimonials, reviewSchemaFor } from '../data/testimonials.js';
import { HOMES } from '../data/lazybeeRooms.js';
import { FAQ as OWNER_FAQ } from '../data/ownerPage.js';
import {
  orgSchema,
  localBusinessSchemas,
  faqPageSchema,
  breadcrumbSchema,
  websiteSchema,
  roomListSchema,
} from './seo.js';

export const BASE_URL = 'https://www.lazybee.sg';
export const SITE_NAME = 'Lazybee';
export const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.png`;

/* Room rents across the three homes, from the live inventory file. Stated as a
   range rather than a "from" price so we never understate what a room costs. */
export const RENT_MIN = 600;
export const RENT_MAX = 2200;

/* The three homes, by the MRT area a person would actually search for. */
export const AREAS = ['Upper Thomson', 'Jurong East', 'Serangoon'];

const DEFAULT_DESCRIPTION =
  'Lazybee runs managed co-living in three Singapore condominiums at Upper Thomson, ' +
  'Jurong East and Serangoon. All-inclusive furnished rooms from S$600 to S$2,200 a month, ' +
  'bills and weekly common-area cleaning included, no agent fees.';

/* The landlord FAQ is the copy that is actually on /faqs. It is duplicated here
   from FAQsPage so the FAQPage structured data and the visible questions cannot
   drift apart, which Google treats as a structured-data violation. */
export const FAQ_PAGE_QUESTIONS = [
  {
    q: 'How does the Lazybee master lease work?',
    a: 'We lease your whole unit on a 12 to 24 month agreement and pay you a fixed monthly rent. We then furnish it and run it as managed co-living. You get one guaranteed payment, with no tenants to chase and no void periods.',
  },
  {
    q: 'Will I really earn more than renting it out normally?',
    a: 'Typically around 10% above open-market whole-unit rent, plus you save agent commission and lose nothing to vacancy. Enter your postal code in the estimator on the home page for a figure on your specific unit.',
  },
  {
    q: 'Who handles furnishing, tenants and maintenance?',
    a: 'We do, entirely, at our cost. Furnishing and fit-out, photography, marketing, tenant screening, rent collection, cleaning and repairs all sit with Lazybee. You are completely hands-off.',
  },
  {
    q: 'What condition does my unit need to be in?',
    a: 'Vacant possession is all we need. Unfurnished or part-furnished are both fine, because we fit out every unit to the same standard ourselves.',
  },
  {
    q: 'What are the lease terms?',
    a: 'Typically 12 to 24 months with a standard notice clause. Longer terms unlock better rates for you and let us invest more into the unit.',
  },
  {
    q: 'How is my property protected?',
    a: 'A security deposit, a move-in condition report, landlord-friendly insurance, and regular checks by our in-house captains. Every unit is run to a single operating SOP, so it comes back in the condition it went out.',
  },
  {
    q: 'Can I invest instead of leasing my unit?',
    a: 'Yes. Alongside landlords, we work with capital partners backing the portfolio. Request the deck and we will share financials and pipeline under NDA.',
  },
  {
    q: 'How do I get an offer?',
    a: 'Send us your unit details or postal code, we arrange a quick viewing, and we come back with a guaranteed monthly offer, usually within the week. WhatsApp +65 8069 5410.',
  },
];

const crumb = (name, path) =>
  breadcrumbSchema([{ name: 'Home', path: '/' }, { name, path }]);

/**
 * Every route the build turns into real static HTML.
 *
 * Nothing under /portal is here and nothing under /portal ever should be: those
 * pages are behind auth, they must stay client-only, and they are served the
 * noindex SPA shell instead.
 */
export const ROUTE_META = {
  '/': {
    title: 'Be a lazy landlord | Lazybee',
    description:
      'Hand your Singapore condo to Lazybee and we run it as managed co-living. We do the viewings, ' +
      'the contracts, the furnishing and the cleaning. You are paid a floor whether the rooms are full ' +
      'or empty, and you keep half the upside. Ninety days to decide.',
    schema: () => [
      orgSchema(),
      websiteSchema(),
      ...localBusinessSchemas(),
      /* The rooms themselves. This page is where the comb shows all nineteen,
         so it is where a machine should be able to read them: type, price,
         size, occupancy, minimum stay, amenities and the booking link for
         each one. Before this the whole site published no room data at all. */
      roomListSchema(),
      faqPageSchema(OWNER_FAQ.map(([q, a]) => ({ q, a }))),
    ],
  },

  '/faqs': {
    title: 'Landlord and investor FAQs | Lazybee',
    description:
      'How the Lazybee managed co-living master lease works for Singapore landlords and investors: ' +
      'what we pay, lease terms, who handles furnishing and tenants, how your unit is protected, ' +
      'and how to get a guaranteed offer.',
    schema: () => [
      orgSchema(),
      faqPageSchema(FAQ_PAGE_QUESTIONS),
      crumb('FAQs', '/faqs'),
    ],
  },

  '/developers': {
    title: 'Lazybee Partner API | Developers',
    description:
      'Integrate Lazybee co-living inventory over a versioned JSON API: properties, room listings with ' +
      'media and features, live availability calendars, partner rates, booking-request intake and ' +
      'signed webhooks. API keys issued per partner.',
    schema: () => [orgSchema(), crumb('Developers', '/developers')],
  },

  '/contact': {
    title: 'Contact Lazybee',
    description:
      'Reach the Lazybee team directly. WhatsApp +65 8069 5410 or email mark@meetmillia.com. ' +
      'For landlords, investors and partners. Rooms and availability live on book.lazybee.sg.',
    schema: () => [
      orgSchema(),
      ...localBusinessSchemas(),
      crumb('Contact', '/contact'),
    ],
  },

  '/privacy-policy': {
    title: 'Privacy Policy | Lazybee',
    description:
      'How Lazybee, operated by Makery Pte. Ltd., collects, uses, shares and retains personal data ' +
      'from residents, landlords and website visitors in Singapore, and the rights you have over it.',
    schema: () => [orgSchema(), crumb('Privacy Policy', '/privacy-policy')],
  },

  '/terms-of-service': {
    title: 'Terms of Service | Lazybee',
    description:
      'The terms governing use of lazybee.sg and Lazybee co-living services operated by Makery Pte. Ltd.: ' +
      'accounts, booking and payment, house rules, maintenance, liability, termination and dispute resolution.',
    schema: () => [orgSchema(), crumb('Terms of Service', '/terms-of-service')],
  },

  '/cookie-policy': {
    title: 'Cookie Policy | Lazybee',
    description:
      'Which cookies and similar technologies lazybee.sg uses, what each one is for, how long they last, ' +
      'and how to control or disable them in your browser.',
    schema: () => [orgSchema(), crumb('Cookie Policy', '/cookie-policy')],
  },
};

/* The Hive owns its own routes, because they are derived from the markdown files
   on disk rather than declared by hand. Spreading them in here means adding an
   article automatically adds it to the prerender and to the sitemap, with no
   second list to keep in step. */

/**
 * Resident reviews, in English and Chinese.
 *
 * Unlisted: nothing on the site links here, it is not in the nav and not in the
 * footer. It is indexable and it is in the sitemap, because being read by
 * search engines and by the assistants people now ask for housing
 * recommendations is the only reason it exists. Same trick the Burmese and
 * Bengali Hive articles use.
 *
 * Gated on there being something to show. An empty reviews page is a soft 404
 * to a crawler and a dead end to a reader, so with no testimonials collected
 * these routes are simply not built and not listed. Adding the first real quote
 * to src/data/testimonials.js publishes them, with no second list to remember.
 */
const REVIEW_ROUTE_META = {
  '/reviews': {
    title: 'Resident reviews | Lazybee co-living Singapore',
    description:
      'Real reviews from people who have lived in Lazybee co-living rooms in Singapore, at Chiltern ' +
      'Park, Ivory Heights and Thomson Grove. In their own words, published with their consent.',
    lang: 'en',
    htmlLang: 'en',
    ogLocale: 'en_SG',
    alternates: [
      { hreflang: 'en', href: `${BASE_URL}/reviews` },
      { hreflang: 'zh-Hans', href: `${BASE_URL}/zh/reviews` },
      { hreflang: 'x-default', href: `${BASE_URL}/reviews` },
    ],
    schema: () => [orgSchema(), crumb('Reviews', '/reviews'), reviewSchemaFor('en')].filter(Boolean),
  },

  '/zh/reviews': {
    title: 'Lazybee 住客评价',
    description:
      'Lazybee 新加坡共居公寓的真实住客评价，来自 Chiltern Park、Ivory Heights 与 Thomson Grove 的住客本人，' +
      '均已获得本人同意刊登。',
    lang: 'zh',
    htmlLang: 'zh-Hans',
    ogLocale: 'zh_CN',
    alternates: [
      { hreflang: 'en', href: `${BASE_URL}/reviews` },
      { hreflang: 'zh-Hans', href: `${BASE_URL}/zh/reviews` },
      { hreflang: 'x-default', href: `${BASE_URL}/reviews` },
    ],
    schema: () => [orgSchema(), crumb('\u4f4f\u5ba2\u8bc4\u4ef7', '/zh/reviews'), reviewSchemaFor('zh')].filter(Boolean),
  },
};

/* Only the language variants that actually have quotes in them. */
const LIVE_REVIEW_ROUTES = Object.fromEntries(
  Object.entries(REVIEW_ROUTE_META).filter(([, m]) => hasTestimonials(m.lang))
);

export const ALL_ROUTE_META = { ...ROUTE_META, ...LIVE_REVIEW_ROUTES, ...HIVE_ROUTE_META };

export const PRERENDER_ROUTES = [
  ...Object.keys(ROUTE_META),
  ...Object.keys(LIVE_REVIEW_ROUTES),
  ...HIVE_ROUTES,
];

/** Absolute canonical for a route. Always self-referencing, never the homepage. */
export function canonicalFor(route) {
  return route === '/' ? `${BASE_URL}/` : `${BASE_URL}${route}`;
}

export { DEFAULT_DESCRIPTION, HOMES };
