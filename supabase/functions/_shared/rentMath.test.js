// Run with: node --test supabase/functions/_shared/rentMath.test.js
//
// The move-out case below is the one that matters: it fails against the logic
// this replaces, which prorated move-ins only and billed a tenant leaving on
// the 10th for the whole month.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthStart,
  daysInMonth,
  occupancyWindow,
  rentForMonth,
  paymentRefFor,
} from "./rentMath.js";

test("monthStart pins any date to the first of its month", () => {
  assert.equal(monthStart("2026-08-23"), "2026-08-01");
  assert.equal(monthStart("2026-08-01"), "2026-08-01");
});

test("daysInMonth handles short months and leap years", () => {
  assert.equal(daysInMonth("2026-08-01"), 31);
  assert.equal(daysInMonth("2026-09-01"), 30);
  assert.equal(daysInMonth("2026-02-01"), 28);
  assert.equal(daysInMonth("2028-02-01"), 29);
});

test("a full month is the whole month", () => {
  const w = occupancyWindow("2026-08-01", "2026-05-01", null);
  assert.deepEqual(w, { firstDay: 1, lastDay: 31, days: 31 });
});

test("a mid-month move-in starts on the move-in day", () => {
  const w = occupancyWindow("2026-08-01", "2026-08-15", null);
  assert.deepEqual(w, { firstDay: 15, lastDay: 31, days: 17 });
});

test("a mid-month move-out ends on the move-out day", () => {
  const w = occupancyWindow("2026-08-01", "2026-01-01", "2026-08-10");
  assert.deepEqual(w, { firstDay: 1, lastDay: 10, days: 10 });
});

test("moving in and out inside one month bills only that window", () => {
  const w = occupancyWindow("2026-08-01", "2026-08-05", "2026-08-20");
  assert.deepEqual(w, { firstDay: 5, lastDay: 20, days: 16 });
});

test("a tenancy that has not started is not billed", () => {
  assert.equal(occupancyWindow("2026-08-01", "2026-09-01", null), null);
});

test("a tenancy that already ended is not billed", () => {
  assert.equal(occupancyWindow("2026-08-01", "2026-01-01", "2026-07-31"), null);
});

test("an end before the start in the same month is refused, not billed zero", () => {
  assert.equal(occupancyWindow("2026-08-01", "2026-08-20", "2026-08-05"), null);
});

test("a full month bills the full rent and is not marked prorated", () => {
  const r = rentForMonth({ month: "2026-08-01", monthlyRent: 1500, start: "2026-05-01" });
  assert.deepEqual(r, { amount: 1500, prorated: false, days: 31, ofDays: 31 });
});

test("a move-in on the 15th of a 31-day month bills 17/31", () => {
  const r = rentForMonth({ month: "2026-08-01", monthlyRent: 1500, start: "2026-08-15" });
  assert.equal(r.prorated, true);
  assert.equal(r.days, 17);
  assert.equal(r.amount, 822.58); // 1500 * 17 / 31
});

test("THE BUG: a move-out on the 10th bills 10/31, not the full month", () => {
  const r = rentForMonth({
    month: "2026-08-01",
    monthlyRent: 1500,
    start: "2026-01-01",
    end: "2026-08-10",
  });
  assert.equal(r.amount, 483.87); // 1500 * 10 / 31
  assert.notEqual(r.amount, 1500);
});

test("no rent configured means skip, never a zero bill", () => {
  assert.equal(rentForMonth({ month: "2026-08-01", monthlyRent: 0 }), null);
  assert.equal(rentForMonth({ month: "2026-08-01", monthlyRent: null }), null);
});

test("a tenancy outside the month is skipped, never billed zero", () => {
  assert.equal(
    rentForMonth({ month: "2026-08-01", monthlyRent: 1500, start: "2026-09-05" }),
    null
  );
});

test("amounts are rounded to cents", () => {
  const r = rentForMonth({ month: "2026-02-01", monthlyRent: 1000, start: "2026-02-10" });
  assert.equal(r.amount, Math.round(r.amount * 100) / 100);
  assert.equal(r.amount, 678.57); // 1000 * 19 / 28
});

test("paymentRefFor matches the database trigger's format", () => {
  assert.equal(paymentRefFor("CP-PR3", "2026-08-01"), "LB-CPPR3-2608");
  assert.equal(paymentRefFor("IH-STD2", "2026-08-01"), "LB-IHSTD2-2608");
  assert.equal(paymentRefFor(null, "2026-08-01"), "LB-UNK-2608");
});
