// src/data/testimonials.js
//
// What real residents have said about living here, in their own words.
//
// ── The rule this file exists to enforce ─────────────────────────────
//
// Every entry must be a real quote from a real person who really lived in the
// room named. Not a paraphrase written for them, not a composite, not a line
// drafted in-house and attributed to a plausible name. The page renders Review
// structured data, which tells Google and every AI assistant that reads it that
// these are genuine customer reviews, and it is read by people deciding where
// to live. A fabricated entry here is a false testimonial: it misleads someone
// making a housing decision, and under Singapore's Consumer Protection (Fair
// Trading) Act it is Makery's problem, not a marketing shortcut.
//
// A batch of thirty invented testimonials was offered for this file on
// 18 Aug 2026 and rejected. None of the thirty names appeared anywhere in
// tenant_details, every one was rated exactly five, and each was written to hit
// a different feature on the marketing list. That is what fabricated looks like
// when it arrives, so the check is: does this person exist in the tenancy
// records, and did they actually send us these words.
//
// ── Consent ──────────────────────────────────────────────────────────
//
// Ask before publishing, and record what they agreed to. `display` is how they
// asked to be credited, so "Karen" and "Karen F." are both fine and a full name
// only goes up if they said so. `consentedAt` is the date they agreed, so we
// can answer the question later.
//
// ── Adding one ───────────────────────────────────────────────────────
//
// Add the entry, run `npm run build`, done. The route publishes itself: an
// empty file means /reviews is not prerendered, not in the sitemap and not
// indexed, because an empty reviews page reads as a dead page to a crawler and
// tells a reader nothing. One real entry and it goes live in both languages.
//
// `zh` is the Chinese rendering of the same quote. Leave it null and that entry
// simply does not appear on /zh/reviews, which is better than showing a reader
// English on a Chinese page or a machine translation nobody checked.

/**
 * @typedef {object} Testimonial
 * @property {string}      id           stable slug, used as the schema @id
 * @property {string}      display      the name as they asked to be credited
 * @property {string}      property     "Chiltern Park" | "Ivory Heights" | "Thomson Grove"
 * @property {string}      room         the room they actually held
 * @property {number}      months       length of tenancy, whole months
 * @property {string}      quote        their words, in English, unedited beyond trimming
 * @property {string|null} zh           the same quote in Chinese, or null
 * @property {number}      rating       1 to 5, as they gave it
 * @property {string}      consentedAt  ISO date they agreed to publication
 * @property {string}      collectedVia "whatsapp" | "email" | "portal"
 */

/** @type {Testimonial[]} */
export const TESTIMONIALS = [
  // Empty on purpose. Nothing real has been collected yet.
  //
  // Shape, for whoever adds the first one:
  //
  // {
  //   id: 'karen-ih-2026',
  //   display: 'Karen',
  //   property: 'Ivory Heights',
  //   room: 'IH Standard Room 1',
  //   months: 14,
  //   quote: 'their words, exactly as they sent them',
  //   zh: null,
  //   rating: 5,
  //   consentedAt: '2026-08-20',
  //   collectedVia: 'whatsapp',
  // },
];

/** Testimonials that can be shown in a given language. */
export function testimonialsFor(lang) {
  if (lang === 'zh') return TESTIMONIALS.filter((t) => t.zh);
  return TESTIMONIALS;
}

/** The quote to render, in the requested language. */
export function quoteFor(testimonial, lang) {
  return lang === 'zh' ? testimonial.zh : testimonial.quote;
}

/**
 * Whether the page is worth publishing at all.
 *
 * Used by the route table, so an empty file keeps /reviews out of the sitemap
 * and out of the prerender rather than shipping a page with a heading and
 * nothing under it.
 */
export function hasTestimonials(lang) {
  return testimonialsFor(lang).length > 0;
}

/**
 * The average, over real ratings only.
 *
 * Returned as null below three reviews. An aggregateRating computed from one or
 * two is a number that looks like evidence and is not, and Google's own review
 * snippet guidance treats a lone aggregate as a quality problem.
 */
export function aggregateRating(lang = 'en') {
  const list = testimonialsFor(lang);
  if (list.length < 3) return null;
  const sum = list.reduce((acc, t) => acc + t.rating, 0);
  return {
    value: Math.round((sum / list.length) * 10) / 10,
    count: list.length,
  };
}

/**
 * Review structured data for a language, or null when there is nothing real to
 * claim.
 *
 * Lives here rather than in the page component because scripts/prerender.mjs
 * builds the JSON-LD from ROUTE_META.schema(), so anything a component emits
 * through react-helmet never reaches the static HTML a crawler reads. That is
 * not theoretical: the first build of this page shipped with Organization and
 * BreadcrumbList only, and the reviews, which are the entire point, were
 * client-side. Same one-array discipline as FAQ_PAGE_QUESTIONS: the words a
 * visitor reads and the words handed to Google are the same strings.
 */
export function reviewSchemaFor(lang = 'en') {
  const list = testimonialsFor(lang);
  if (!list.length) return null;
  const path = lang === 'zh' ? '/zh/reviews' : '/reviews';
  const agg = aggregateRating(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Lazybee',
    url: 'https://www.lazybee.sg',
    ...(agg
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: agg.value,
            reviewCount: agg.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    review: list.map((r) => ({
      '@type': 'Review',
      '@id': `https://www.lazybee.sg${path}#${r.id}`,
      author: { '@type': 'Person', name: r.display },
      datePublished: r.consentedAt,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: quoteFor(r, lang),
    })),
  };
}
