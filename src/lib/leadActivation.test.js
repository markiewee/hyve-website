import test from "node:test";
import assert from "node:assert/strict";
import { conditionFires, sendingHoursNow } from "./leadActivation.js";
import { ACTIVATION_TYPES } from "./partnerLeads.js";

const ROOMS = [
  { listing_code: "CP-MR", price_monthly: 2200, in_sell_window: true },
  { listing_code: "IH-STD1", price_monthly: 1000, in_sell_window: false },
  { listing_code: "TG-PR2", price_monthly: 1450, in_sell_window: true },
];
const NOW = new Date("2026-08-13T00:00:00Z");

test("DATE wakes a lead inside eight weeks of the move-in, not before", () => {
  // Eight weeks is the lead time from first contact to a signature, so
  // waking earlier just annoys somebody who cannot act yet.
  assert.equal(conditionFires({ type: "DATE", on: "2026-09-01" }, { rooms: ROOMS, now: NOW }), true);
  assert.equal(conditionFires({ type: "DATE", on: "2026-10-07" }, { rooms: ROOMS, now: NOW }), true);
  assert.equal(conditionFires({ type: "DATE", on: "2026-12-01" }, { rooms: ROOMS, now: NOW }), false);
});

test("a date already past still fires, because they are overdue not early", () => {
  assert.equal(conditionFires({ type: "DATE", on: "2026-07-01" }, { rooms: ROOMS, now: NOW }), true);
});

test("ROOM wakes only when that exact room is actually sellable", () => {
  // IH-STD1 exists but is not in the sell window, and telling somebody a
  // room is available when it is not is the expensive mistake here.
  assert.equal(conditionFires({ type: "ROOM", listing_code: "CP-MR" }, { rooms: ROOMS, now: NOW }), true);
  assert.equal(conditionFires({ type: "ROOM", listing_code: "IH-STD1" }, { rooms: ROOMS, now: NOW }), false);
  assert.equal(conditionFires({ type: "ROOM", listing_code: "NOPE-1" }, { rooms: ROOMS, now: NOW }), false);
});

test("BUDGET wakes when any sellable room comes within their cap", () => {
  assert.equal(conditionFires({ type: "BUDGET", max_monthly: 2200 }, { rooms: ROOMS, now: NOW }), true,
    "at the cap counts as within it");
  assert.equal(conditionFires({ type: "BUDGET", max_monthly: 1500 }, { rooms: ROOMS, now: NOW }), true,
    "TG-PR2 at 1450 fits");
  assert.equal(conditionFires({ type: "BUDGET", max_monthly: 900 }, { rooms: ROOMS, now: NOW }), false);
  assert.equal(conditionFires({ type: "BUDGET", max_monthly: 1000 }, { rooms: ROOMS, now: NOW }), false,
    "IH-STD1 would fit the budget but is not sellable");
});

test("MANUAL fires whenever a human armed it", () => {
  assert.equal(conditionFires({ type: "MANUAL" }, { rooms: ROOMS, now: NOW }), true);
});

test("a malformed condition never fires", () => {
  // This function decides whether to message a real stranger, so anything
  // it does not fully understand must stay silent.
  for (const bad of [null, undefined, {}, "MANUAL", 7,
                     { type: "DATE" }, { type: "DATE", on: "next tuesday" },
                     { type: "ROOM" }, { type: "BUDGET" },
                     { type: "BUDGET", max_monthly: 0 },
                     { type: "BUDGET", max_monthly: -50 },
                     { type: "BUDGET", max_monthly: "cheap" },
                     { type: "WHATEVER" }]) {
    assert.equal(conditionFires(bad, { rooms: ROOMS, now: NOW }), false,
      `should not fire: ${JSON.stringify(bad)}`);
  }
});

test("no room data means nothing fires except a manual arm", () => {
  // The nightly job refuses to run on unreadable sell-state, but if an empty
  // list ever reaches here it must not read as "nothing is available" and
  // quietly fire a BUDGET condition against zero rooms.
  assert.equal(conditionFires({ type: "ROOM", listing_code: "CP-MR" }, { rooms: [], now: NOW }), false);
  assert.equal(conditionFires({ type: "BUDGET", max_monthly: 9999 }, { rooms: [], now: NOW }), false);
  assert.equal(conditionFires({ type: "MANUAL" }, { rooms: [], now: NOW }), true);
});

test("every activation type the API accepts is one this evaluator understands", () => {
  // A lead can be stored with any type validateLead permits. If a type is
  // added there and not here, that lead waits forever and nobody notices.
  for (const type of ACTIVATION_TYPES) {
    const probe = {
      DATE: { type: "DATE", on: "2026-08-20" },
      ROOM: { type: "ROOM", listing_code: "CP-MR" },
      BUDGET: { type: "BUDGET", max_monthly: 2200 },
      MANUAL: { type: "MANUAL" },
    }[type];
    assert.ok(probe, `no probe for activation type ${type}: this evaluator does not handle it`);
    assert.equal(conditionFires(probe, { rooms: ROOMS, now: NOW }), true,
      `activation type ${type} is accepted on write but never fires`);
  }
});

test("sending hours run 09:00 to 21:00 Singapore time", () => {
  // Reactivation messages go to people who have not heard from us in weeks.
  // Landing at 3am is how a warm lead becomes a block.
  assert.equal(sendingHoursNow(new Date("2026-08-13T02:00:00Z")), true, "10:00 SGT");
  assert.equal(sendingHoursNow(new Date("2026-08-13T12:59:00Z")), true, "20:59 SGT");
  assert.equal(sendingHoursNow(new Date("2026-08-13T13:00:00Z")), false, "21:00 SGT");
  assert.equal(sendingHoursNow(new Date("2026-08-13T14:00:00Z")), false, "22:00 SGT");
  assert.equal(sendingHoursNow(new Date("2026-08-13T00:30:00Z")), false, "08:30 SGT");
  assert.equal(sendingHoursNow(new Date("2026-08-12T17:00:00Z")), false, "01:00 SGT next day");
});
