// src/data/ownerPage.js
//
// Every list on the owner homepage, kept as data rather than buried in JSX.
//
// Since the page went bilingual on 10 Aug 2026 these arrays hold dictionary KEYS
// rather than English strings: the words themselves live in src/i18n/en.json and
// zh.json under `owner.*`, and the components resolve them through `t()`. The
// order and the shape of each list still lives here, which is what the JSX cares
// about. Mark edits words in the dictionaries now, not in this file.

/* ── the ninety day trial ─────────────────────────────────────────── */
export const ZEROS = [
  'owner.trial.zero1',
  'owner.trial.zero2',
  'owner.trial.zero3',
  'owner.trial.zero4',
];

export const TRIAL_KEEPS = [
  ['owner.trial.keep1.k', 'owner.trial.keep1.v'],
  ['owner.trial.keep2.k', 'owner.trial.keep2.v'],
  ['owner.trial.keep3.k', 'owner.trial.keep3.v'],
  ['owner.trial.keep4.k', 'owner.trial.keep4.v'],
];

/* ── how it runs ──────────────────────────────────────────────────── */

/* ── channels ─────────────────────────────────────────────────────── */
/* Real brand marks where simple-icons has one, a typeset wordmark where it does not.
   The wordmark tiles are marked so it is obvious which logos still need dropping in. */
export const CHANNELS_LIVE = [
  ['Airbnb', 'airbnb'], ['Booking.com', 'bookingdotcom'], ['Agoda', null], ['PropertyGuru', null],
  ['99.co', null], ['Carousell', null], ['Roomies', null], ['Instagram', 'instagram'],
  ['Xiaohongshu', null], ['Facebook', 'facebook'],
];

export const CHANNELS_SOON = [
  ['Coliving.com', null], ['uhomes', null], ['Amber', null], ['Casita', null], ['StuRents', null],
];

/* ── The Hive teaser ──────────────────────────────────────────────── */
export const POSTS = [
  ['/photos/cp/Common-1.jpg', 'Numbers', 'What a Singapore condo actually earns',
    'We took the headline rent on a three bedder in D19 and subtracted every real cost for a year. The gap between the number on the listing and the number in the bank is about a month and a half.'],
  ['/photos/tg-lounge.jpg', 'Rules', 'The three month rule, in practice',
    'URA says three months minimum on a private home. Here is what that means for how you write the agreement, what happens when a tenant leaves early, and the one mistake that gets owners a letter.'],
  ['/photos/ih/PR1.jpg', 'Operations', 'What breaks, and what it costs',
    'Two years of maintenance logs across nineteen cells. Water heaters go first, aircon servicing is the only thing worth doing on a schedule, and repainting on turnover pays for itself.'],
];

/* ── FAQ ──────────────────────────────────────────────────────────── */
export const FAQ = [
  ['owner.faq.catch.q', 'owner.faq.catch.a'],
  ['owner.faq.empty.q', 'owner.faq.empty.a'],
  ['owner.faq.lease.q', 'owner.faq.lease.a'],
  ['owner.faq.furniture.q', 'owner.faq.furniture.a'],
  ['owner.faq.see.q', 'owner.faq.see.a'],
  ['owner.faq.back.q', 'owner.faq.back.a'],
  ['owner.faq.eligible.q', 'owner.faq.eligible.a'],
  ['owner.faq.arrears.q', 'owner.faq.arrears.a'],
  // Absorbed from the retired compliance section: the head is the claim, the body explains it.
  ['owner.legal.stay.head', 'owner.legal.stay.body'],
  ['owner.legal.occ.head', 'owner.legal.occ.body'],
  ['owner.legal.data.head', 'owner.legal.data.body'],
  ['owner.legal.stamp.head', 'owner.legal.stamp.body'],
];

/* ── what happens after the coffee form ───────────────────────────── */
export const WHAT_HAPPENS = [
  ['owner.ask.wh1.t', 'owner.ask.wh1.b'],
  ['owner.ask.wh2.t', 'owner.ask.wh2.b'],
  ['owner.ask.wh3.t', 'owner.ask.wh3.b'],
];
