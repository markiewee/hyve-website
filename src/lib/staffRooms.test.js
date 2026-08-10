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
  isSellNow,
  priceLadder,
  roomMatchesSearch,
  EMPTY_SEARCH,
  isSearchActive,
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
  assert.equal(s.label, "Open now");
  assert.equal(s.tone, "warn");
});

test("free now but ending reads as open now with the end date", () => {
  const s = availabilityStatus(room({ available_until: "2026-09-30" }), TODAY);
  // Sep vs Sept is an ICU difference between Node and the browser, not a bug.
  // Pin the parts we control and let the platform abbreviate the month.
  assert.match(s.label, /^Open now, until 30 Sept? 2026$/);
});

test("a past next_available is open now, not a negative countdown", () => {
  const s = availabilityStatus(room({ next_available: "2026-08-01" }), TODAY);
  assert.equal(s.label, "Open now");
});

test("inside twelve weeks it opens, beyond it is occupied", () => {
  assert.match(availabilityStatus(room({ next_available: "2026-10-01" }), TODAY).label, /^Opens /);
  assert.equal(availabilityStatus(room({ next_available: "2026-10-01" }), TODAY).tone, "warn");
  assert.match(availabilityStatus(room({ next_available: "2027-06-01" }), TODAY).label, /^Occupied to /);
  assert.equal(availabilityStatus(room({ next_available: "2027-06-01" }), TODAY).tone, "ok");
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

test("budget matches within a 200 band on either side", () => {
  const s = { ...EMPTY_SEARCH, budget: "1500" };
  assert.equal(roomMatchesSearch(room({ price_monthly: 1300 }), "CP", s, TODAY), true);
  assert.equal(roomMatchesSearch(room({ price_monthly: 1700 }), "CP", s, TODAY), true);
  assert.equal(roomMatchesSearch(room({ price_monthly: 1299 }), "CP", s, TODAY), false);
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
