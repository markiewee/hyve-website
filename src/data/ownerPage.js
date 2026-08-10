// src/data/ownerPage.js
//
// Every list on the owner homepage, kept as data rather than buried in JSX.
//
// Since the page went bilingual on 10 Aug 2026 these arrays hold dictionary KEYS
// rather than English strings: the words themselves live in src/i18n/en.json and
// zh.json under `owner.*`, and the components resolve them through `t()`. The
// order and the shape of each list still lives here, which is what the JSX cares
// about. Mark edits words in the dictionaries now, not in this file.

/* ── the comparison table ─────────────────────────────────────────── */
export const COMPARE_HEADS = [
  'owner.compare.head1',
  'owner.compare.head2',
  'owner.compare.head3',
];

export const COMPARE_ROWS = [
  ['owner.compare.earn.k', 'owner.compare.earn.a', 'owner.compare.earn.b', 'owner.compare.earn.us'],
  ['owner.compare.locked.k', 'owner.compare.locked.a', 'owner.compare.locked.b', 'owner.compare.locked.us'],
  ['owner.compare.cost.k', 'owner.compare.cost.a', 'owner.compare.cost.b', 'owner.compare.cost.us'],
  ['owner.compare.void.k', 'owner.compare.void.a', 'owner.compare.void.b', 'owner.compare.void.us'],
  ['owner.compare.finding.k', 'owner.compare.finding.a', 'owner.compare.finding.b', 'owner.compare.finding.us'],
  ['owner.compare.commission.k', 'owner.compare.commission.a', 'owner.compare.commission.b', 'owner.compare.commission.us'],
  ['owner.compare.furniture.k', 'owner.compare.furniture.a', 'owner.compare.furniture.b', 'owner.compare.furniture.us'],
  ['owner.compare.twoam.k', 'owner.compare.twoam.a', 'owner.compare.twoam.b', 'owner.compare.twoam.us'],
  ['owner.compare.hours.k', 'owner.compare.hours.a', 'owner.compare.hours.b', 'owner.compare.hours.us'],
  ['owner.compare.see.k', 'owner.compare.see.a', 'owner.compare.see.b', 'owner.compare.see.us'],
  ['owner.compare.arrears.k', 'owner.compare.arrears.a', 'owner.compare.arrears.b', 'owner.compare.arrears.us'],
];

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

/* ── the owner portal mock ────────────────────────────────────────── */
export const PORTAL_TABS = [
  { id: 'p-stat', label: 'Statement' },
  { id: 'p-docs', label: 'Tenant documents' },
  { id: 'p-log', label: 'Maintenance log' },
  { id: 'p-gal', label: 'Inspection photos' },
];

export const PORTAL_TILES = [
  ['S$8,570', 'Gross, August'],
  ['S$5,325', 'Your payout'],
  ['5 / 6', 'Cells let'],
  ['14 Aug', 'Next transfer'],
];

export const DOCS = [
  ['Licence agreement, CP-PR3', 'Signed 12 Jun 2026 · PDF, 740 KB', 'ok', 'Current'],
  ['IRAS stamp certificate, CP-PR3', 'Stamped 13 Jun 2026 · we filed it', 'ok', 'Stamped'],
  ['Identity document, tenant CP-PR3', 'Passport · S••••827Z · masked under PDPA', 'mut', 'Masked'],
  ['Proof of employment, tenant CP-PR3', 'Letter of employment · verified 10 Jun 2026', 'ok', 'Verified'],
  ['Licence agreement, CP-PR2', 'Signed 2 Dec 2025 · renewal due 1 Dec 2026', 'warn', 'Renewal due'],
  ['Handover inventory, whole unit', '48 items, photographed · signed by both sides', 'ok', 'Signed'],
  ['Fire safety and appliance certificates', 'Aircon, water heater, extinguisher · next check Mar 2027', 'ok', 'In date'],
];

export const LOG = [
  ['7 Aug 2026', 'Aircon servicing, all four units', 'Quarterly service by Kavi. Filters washed, gas topped in the master. 6 photos returned.', 'S$180', 'ok', 'Done'],
  ['22 Jul 2026', 'Water heater replaced, shared bathroom', 'Old unit failed on the 20th, tenant had cold water for two days. Replaced with a Rheem 25L. Your approval logged 21 Jul.', 'S$420', 'ok', 'Done'],
  ['14 Jul 2026', 'Washing machine drain blocked', 'Cleared on site, no parts. Cause was a tenant washing bedding with a loose cover.', 'S$60', 'ok', 'Done'],
  ['2 Jul 2026', 'Repaint, CP-PR1 on turnover', 'Two coats, scuffs from the previous tenancy. Deducted from that deposit, not from you.', 'S$240', 'ok', 'Recovered'],
  ['28 Jun 2026', 'Front door lock stiff', 'Lubricated, still stiff. Locksmith quoted S$310 for a replacement cylinder, waiting on your tap.', 'S$310', 'warn', 'Awaiting you'],
];

export const GAL = [
  ['/photos/cp/MBR.jpg', 'Master, move-in, 12 Jun'],
  ['/photos/cp/Common-1.jpg', 'Living, quarterly, 1 Jul'],
  ['/photos/cp/PR3.jpg', 'CP-PR3, move-in, 12 Jun'],
  ['/photos/cp/PR1.jpg', 'CP-PR1, after repaint, 2 Jul'],
  ['/photos/cp/Common-2.jpg', 'Kitchen, quarterly, 1 Jul'],
  ['/photos/cp/PR2.jpg', 'CP-PR2, quarterly, 1 Jul'],
  ['/photos/cp/STD1.jpg', 'CP-STD1, move-in, 4 Mar'],
  ['/photos/cp/Common-3.jpg', 'Common, quarterly, 1 Jul'],
];

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

/* ── compliance ───────────────────────────────────────────────────── */
export const COMPLIANCE = [
  ['owner.legal.stay.label', 'owner.legal.stay.head', 'owner.legal.stay.body'],
  ['owner.legal.occ.label', 'owner.legal.occ.head', 'owner.legal.occ.body'],
  ['owner.legal.data.label', 'owner.legal.data.head', 'owner.legal.data.body'],
  ['owner.legal.stamp.label', 'owner.legal.stamp.head', 'owner.legal.stamp.body'],
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
];

/* ── what happens after the coffee form ───────────────────────────── */
export const WHAT_HAPPENS = [
  ['owner.ask.wh1.t', 'owner.ask.wh1.b'],
  ['owner.ask.wh2.t', 'owner.ask.wh2.b'],
  ['owner.ask.wh3.t', 'owner.ask.wh3.b'],
];
