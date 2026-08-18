// Run with: node --test src/lib/staffRooms.test.js
//
// The staff page answers a prospect in real time, so the wrong availability
// word or the wrong lease-length price is a wrong quote in a live chat. These
// are the four decisions the page makes; everything else is layout.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLettable,
  availabilityStatus,
  formatDate,
  isSellNow,
  priceLadder,
  roomMatchesSearch,
  EMPTY_SEARCH,
  isSearchActive,
  quotedMonthly,
  quotedLadder,
  quotedOf,
} from "./staffRooms.js";

const TODAY = new Date("2026-08-10T00:00:00");
const room = (over = {}) => ({
  unit_code: "CP-PR1",
  room_type: "premium",
  price_monthly: 1500,
  max_occupancy: 1,
  has_private_bathroom: false,
  next_available: null,
  available_until: null,
  ...over,
});

test("a room is lettable only with both a type and a price", () => {
  assert.equal(isLettable(room()), true);
  assert.equal(isLettable(room({ room_type: null })), false);
  assert.equal(isLettable(room({ price_monthly: null })), false);
});

test("no next_available and no end date reads as open now", () => {
  const s = availabilityStatus(room(), TODAY);
  assert.equal(s.key, "staff.room.openNow");
  assert.equal(s.date, null);
  assert.equal(s.tone, "warn");
});

test("free now but ending carries the end date for the caller to format", () => {
  const s = availabilityStatus(room({ available_until: "2026-09-30" }), TODAY);
  assert.equal(s.key, "staff.room.openUntil");
  assert.equal(s.date, "2026-09-30");
  assert.equal(s.tone, "warn");
});

test("a past next_available is open now, not a negative countdown", () => {
  const s = availabilityStatus(room({ next_available: "2026-08-01" }), TODAY);
  assert.equal(s.key, "staff.room.openNow");
});

test("inside twelve weeks it opens, beyond it is occupied", () => {
  assert.equal(availabilityStatus(room({ next_available: "2026-10-01" }), TODAY).key, "staff.room.opensOn");
  assert.equal(availabilityStatus(room({ next_available: "2026-10-01" }), TODAY).tone, "warn");
  assert.equal(availabilityStatus(room({ next_available: "2027-06-01" }), TODAY).key, "staff.room.occupiedTo");
  assert.equal(availabilityStatus(room({ next_available: "2027-06-01" }), TODAY).tone, "ok");
});

test("dates render in the reader's language", () => {
  // Sep vs Sept is an ICU difference between Node and the browser, not a bug.
  // Pin the parts we control and let the platform abbreviate the month.
  assert.match(formatDate("2026-09-30"), /^30 Sept? 2026$/);
  assert.equal(formatDate("2026-09-30", "zh"), "2026年9月30日");
});

test("the sell window is twelve weeks, inclusive at the boundary", () => {
  // 84 days after 10 Aug 2026 is 2 Nov 2026.
  assert.equal(isSellNow(room({ next_available: "2026-11-02" }), TODAY), true);
  assert.equal(isSellNow(room({ next_available: "2026-11-03" }), TODAY), false);
});

test("a room free now with nothing behind it is always a sell target", () => {
  assert.equal(isSellNow(room(), TODAY), true);
});

test("a room free now but taken again shortly is not a sell target", () => {
  assert.equal(isSellNow(room({ available_until: "2026-09-01" }), TODAY), false);
});

test("the ladder anchors on twelve months at the base price", () => {
  const l = priceLadder(1500);
  assert.deepEqual(l.map((t) => t.months), [3, 6, 12, 24]);
  assert.deepEqual(l.map((t) => t.price), [1600, 1550, 1500, 1450]);
  assert.equal(l.find((t) => t.months === 12).anchor, true);
});

test("no price means no ladder rather than a ladder of NaN", () => {
  assert.equal(priceLadder(null), null);
});

test("budget is a ceiling plus 200, with no floor", () => {
  // A prospect who says 1500 will happily take a 900 room. They will stretch to
  // 1700. They will not be shown 1701.
  const s = { ...EMPTY_SEARCH, budget: "1500" };
  assert.equal(roomMatchesSearch(room({ price_monthly: 600 }), "CP", s, TODAY), true);
  assert.equal(roomMatchesSearch(room({ price_monthly: 1500 }), "CP", s, TODAY), true);
  assert.equal(roomMatchesSearch(room({ price_monthly: 1700 }), "CP", s, TODAY), true);
  assert.equal(roomMatchesSearch(room({ price_monthly: 1701 }), "CP", s, TODAY), false);
});

test("a fixed date needs the room free by then, flexible allows thirty more days", () => {
  const r = room({ next_available: "2026-11-15" });
  const fixed = { ...EMPTY_SEARCH, date: "2026-11-01", dateMode: "fixed" };
  const flex = { ...EMPTY_SEARCH, date: "2026-11-01", dateMode: "flexible" };
  assert.equal(roomMatchesSearch(r, "CP", fixed, TODAY), false);
  assert.equal(roomMatchesSearch(r, "CP", flex, TODAY), true);
});

test("a room vacated before the move-in date does not match it", () => {
  const r = room({ available_until: "2026-09-01" });
  const s = { ...EMPTY_SEARCH, date: "2026-10-01" };
  assert.equal(roomMatchesSearch(r, "CP", s, TODAY), false);
});

test("the sleeps-two and ensuite chips filter on the real columns", () => {
  assert.equal(roomMatchesSearch(room(), "CP", { ...EMPTY_SEARCH, couple: true }, TODAY), false);
  assert.equal(roomMatchesSearch(room({ max_occupancy: 2 }), "CP", { ...EMPTY_SEARCH, couple: true }, TODAY), true);
  assert.equal(roomMatchesSearch(room(), "CP", { ...EMPTY_SEARCH, ensuite: true }, TODAY), false);
  assert.equal(roomMatchesSearch(room({ has_private_bathroom: true }), "CP", { ...EMPTY_SEARCH, ensuite: true }, TODAY), true);
});

test("an untouched search is not active, any one control makes it active", () => {
  assert.equal(isSearchActive(EMPTY_SEARCH), false);
  assert.equal(isSearchActive({ ...EMPTY_SEARCH, location: "CP" }), true);
  assert.equal(isSearchActive({ ...EMPTY_SEARCH, sell: true }), true);
  // dateMode alone is not a filter: it only qualifies a date.
  assert.equal(isSearchActive({ ...EMPTY_SEARCH, dateMode: "flexible" }), false);
});

// ── channel pricing on the desk ─────────────────────────────────────────────
//
// The desk showed rooms.price_monthly to everybody for the whole time Lili and
// Fiona held PINs, so these assert the two halves of the fix: a partner sees
// their own price everywhere, and an internal PIN sees exactly what it saw
// before any of this existed.

const WELCOMESTAY = { slug: "welcomestay", commission_pct: 0.05, gross_up: true };
const GOODLIFE = { slug: "goodlife", commission_months: 1, gross_up: true };
const ABSORBED = { slug: "absorbed", commission_pct: 0.15, gross_up: false };

test("a null channel quotes base, unchanged, at every rung", () => {
  // The regression that matters most: captains and Mark must not move.
  assert.equal(quotedMonthly(1000, null), 1000);
  assert.deepEqual(quotedLadder(1000, null), priceLadder(1000));
});

test("a percentage channel grosses up so we still net base", () => {
  // 1000 / 0.95 = 1052.63, and 5% of 1053 comes back off it.
  assert.equal(quotedMonthly(1000, WELCOMESTAY), 1053);
  assert.equal(quotedMonthly(2200, WELCOMESTAY), 2316);
});

test("a months channel uplifts by lease length, so the rungs differ", () => {
  // One month of commission is half of a two month lease and a twelfth of a
  // twelve month one. A single uplift reused across the ladder would be wrong
  // on three of the four rungs, and worst on the short ones.
  const ladder = quotedLadder(1000, GOODLIFE);
  const at = (m) => ladder.find((r) => r.months === m).price;

  // 3 months: base+100 = 1100, uplifted by 3/2.
  assert.equal(at(3), 1650);
  // 12 months: base = 1000, uplifted by 12/11.
  assert.equal(at(12), 1091);
  // 24 months: base-50 = 950, uplifted by 24/23.
  assert.equal(at(24), 991);
  // Strictly increasing uplift as the lease shortens, never a flat multiple.
  assert.ok(at(3) / 1100 > at(12) / 1000);
});

test("the ladder adjustment is grossed up too, not bolted on after", () => {
  // The three month rung is base+100 quoted through the channel, not the
  // twelve month quote plus a bare 100. Otherwise the extra 100 carries no
  // commission and we pay it out of margin.
  const at3 = quotedLadder(1000, WELCOMESTAY).find((r) => r.months === 3).price;
  assert.equal(at3, quotedMonthly(1100, WELCOMESTAY, 3));
  assert.notEqual(at3, quotedMonthly(1000, WELCOMESTAY) + 100);
});

test("a channel we absorb the cost of quotes base", () => {
  assert.equal(quotedMonthly(1000, ABSORBED), 1000);
});

test("quotedOf prefers the stamped price and falls back to base", () => {
  assert.equal(quotedOf({ price_monthly: 1000, quoted_monthly: 1053 }), 1053);
  assert.equal(quotedOf({ price_monthly: 1000 }), 1000);
  assert.equal(quotedOf({}), null);
});

test("the budget filter reads the price the viewer is actually shown", () => {
  // An agent typing 1000 means the numbers on their screen. A 1000 room quoted
  // to them at 1053 is still inside the stretch; one quoted at 1300 is not.
  const room = { price_monthly: 1000, quoted_monthly: 1053, room_type: "standard" };
  const search = { ...EMPTY_SEARCH, budget: "1000" };
  assert.equal(roomMatchesSearch(room, "IH", search, TODAY), true);

  const pricey = { ...room, quoted_monthly: 1300 };
  assert.equal(roomMatchesSearch(pricey, "IH", search, TODAY), false);

  // And the same room, unstamped, still matches on base as it always did.
  assert.equal(
    roomMatchesSearch({ price_monthly: 1000, room_type: "standard" }, "IH", search, TODAY),
    true,
  );
});
