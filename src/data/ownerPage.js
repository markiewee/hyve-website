// src/data/ownerPage.js
//
// Every list on the owner homepage, kept as data rather than buried in JSX.
// Copy ported verbatim from design-preview/owners.html. Mark edits words here,
// not in a component.

/* ── the comparison table ─────────────────────────────────────────── */
export const COMPARE_HEADS = [
  'Agent, then a fixed lease',
  'Run it yourself, room by room',
  'Lazybee, floor plus share',
];

export const COMPARE_ROWS = [
  ['What you earn', 'One number, fixed for the term', 'Everything, minus everything', 'A floor, plus half of everything above it'],
  ['Locked in for', 'Two or three years, from signature', 'Nothing, it is all on you', 'Ninety days, then it is your call'],
  ['Cost to find out', "An agent's time, then a decision", 'Your evenings', 'Nothing. We spend first, you decide after'],
  ['The empty month', 'Yours, at every turnover', 'Yours', 'Ours. The floor still lands on the first'],
  ['Finding tenants', 'Two portals, then waiting', 'You, every single time', 'Fourteen channels, most of them outside Singapore'],
  ['Agent commission', 'Half a month, again at every renewal', 'None', 'None, ever'],
  ['Furniture and fit-out', 'Yours, or you let it bare and price it lower', 'Yours', 'Ours, at our cost, to one standard'],
  ['Who answers at 2am', 'You', 'You', 'A house captain who lives in the building'],
  ['Your hours a month', 'Two to four, spiking at turnover', 'Eight to fifteen', 'None, unless you want them'],
  ['What you can see', 'A bank transfer', 'Everything, because you are doing it', 'Everything, live, in an owner portal'],
  ['If a tenant stops paying', 'Your problem, and your lawyer', 'Your problem', 'Ours. It does not touch your floor'],
];

/* ── the ninety day trial ─────────────────────────────────────────── */
export const ZEROS = [
  'To try it',
  'Furnishing and photography',
  'Agent commission, ever',
  'To walk away at day ninety',
];

export const TRIAL_KEEPS = [
  ['Condition report and photo set', 'Yours, from day one'],
  ['Every floor payment already made', 'Never clawed back'],
  ['Our list of what the unit needs', 'Yours, even if you say no'],
  ['The unit itself', 'Back as we found it'],
];

/* ── how it runs ──────────────────────────────────────────────────── */
export const STEPS = [
  ['Send three facts', 'Postal code, floor area, bedrooms. We come back within a week with a floor and a split, or we tell you plainly that your unit is not a fit. Nothing to pay and nothing to sign.'],
  ['We walk the unit', 'Thirty minutes. We measure, photograph, and write down exactly what has to happen before anyone can live in it. That condition report is yours to keep whether or not you go ahead with us.'],
  ['We spend first', 'Furnishing at our cost, photography at our cost, every cell live across the channels inside a week. Your floor starts on the first of the following month. You are still not locked into anything.'],
  ['Ninety days of watching it run', 'Your owner login goes live the same day the rooms do. Every booking, every rate, every payout, as it happens. This is the part owners tell us they did not expect to enjoy.'],
  ['Then decide', 'Carry on, and the floor and share run on. Or walk, at no cost, with nothing clawed back and our furniture out at our expense.'],
];

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
  ['Minimum stay', 'Never short-let', 'Every tenancy is written at three months or longer, inside the URA rule for private homes. No nightly stays, no exceptions, no letter from the authorities.'],
  ['Occupancy', 'Inside the cap', 'We let to the occupancy limit for your property type and write that limit into the agreement, so an extra body cannot quietly appear.'],
  ['Data', 'PDPA, and GDPR', 'Tenant identity documents are collected once, stored encrypted, masked in the portal, and deleted on schedule. Our tenants come from Europe too, so we hold to GDPR as well.'],
  ['Stamping', 'IRAS, by us', 'Every agreement is stamped, and we do the stamping for tenants who have no Singapore bank account yet. The certificate sits in your portal.'],
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
  ['What is the catch with the ninety days?', 'That we spend real money on your unit before you owe us anything, and we are betting you will not want to unwind it once you have watched it run. That is the bet, and it is on our side of the table. The only string is the tenancies: anyone we house signs a real lease, so at day ninety you either take those over as they stand or give us the time to see them out.'],
  ['What if the rooms sit empty?', 'Then you are paid the floor and we are paid nothing. The floor is the first call on the money, ahead of our costs and well ahead of our margin. That is the point of the structure, and it is why we will not quote a floor before we have seen the unit.'],
  ['So the floor is just a lease with extra steps?', 'In a bad year, yes, and deliberately so. The difference shows up in a normal year, when a lease would have kept the whole upside on our side of the table and this does not.'],
  ['Who pays for the furniture?', 'We do, at our cost, to one standard across every home. You put in nothing. At the end of the term the unit comes back the way we found it, or better, with the condition written down and photographed on day one.'],
  ['Can I actually see what is happening?', 'Yes, from the day you sign, and you can see most of it on this page already. Every booking, every rate, every payout line, the tenant documents, the maintenance log and the inspection photos. Not a quarterly PDF.'],
  ['What if I want the unit back?', 'There is a notice period and it is in the agreement before you sign. We will not hold your asset hostage. What we ask is enough notice to see out the tenancies already signed, because those are real people with leases.'],
  ['Is my unit even eligible?', 'Private condominiums and apartments, let at three months or longer, within the occupancy cap. HDB flats do not work for this model and we will say so rather than waste your afternoon.'],
  ['Who deals with a tenant who stops paying?', 'We do, and it does not touch your floor. You will read about it in the arrears log if you want to. You will not be asked to do anything about it.'],
];

/* ── what happens after the coffee form ───────────────────────────── */
export const WHAT_HAPPENS = [
  ['Within a day', 'Marcus messages you on WhatsApp to pick a time and a place. Your place, your office, the coffee shop downstairs, whichever is least effort for you.'],
  ['Forty minutes, in person', 'No slides and no laptop. He brings a printed one page read on your unit, worked out from what you have entered here plus what the district is actually renting for.'],
  ['You keep the paper', 'Whether you go ahead or not. If your unit is not a fit he will say so at the table rather than send you a polite email next week.'],
];
