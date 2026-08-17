// Run with: node --test supabase/functions/_shared/arrearsLadder.test.js
//
// The rung boundaries are the whole point. The live ladder charges a 5% fee at
// day 5 and a second at day 29; getting either boundary wrong either double
// charges a tenant or lets an arrear run free, so every boundary is pinned here.
//
// The day 8 case is the one that catches a naive rewrite: reminders run every
// OTHER day from 7, so 7, 9, 11 speak and 8, 10, 12 stay quiet. A ladder that
// reminds daily reads as harassment on a bill that may already be in transit.

import { test } from "node:test";
import assert from "node:assert/strict";
import { selectRung } from "./arrearsLadder.js";

const base = {
  daysOverdue: 0,
  lastRemindedAtDays: 0,
  feeCount: 0,
  outstanding: 1300,
  currentFee: 0,
};

test("day 3 fires the friendly nudge and charges nothing", () => {
  const r = selectRung({ ...base, daysOverdue: 3 });
  assert.equal(r.event, "INVOICE_LATE_NOTICE");
  assert.equal(r.newFee, 0);
});

test("day 4 warns that the fee lands tomorrow, still charging nothing", () => {
  const r = selectRung({ ...base, daysOverdue: 4 });
  assert.equal(r.event, "INVOICE_LATE_FEE_WARNING");
  assert.equal(r.newFee, 0);
  assert.equal(r.estimatedLateFee, 65);
});

test("day 5 applies the first 5% fee", () => {
  const r = selectRung({ ...base, daysOverdue: 5 });
  assert.equal(r.event, "INVOICE_OVERDUE");
  assert.equal(r.newFee, 65);
  assert.equal(r.newFeeCount, 1);
});

test("day 7 reminds without charging a second fee", () => {
  const r = selectRung({ ...base, daysOverdue: 7, feeCount: 1, currentFee: 65 });
  assert.equal(r.event, "INVOICE_OVERDUE_REMINDER");
  assert.equal(r.newFee, 0);
});

test("reminders run every other day, so day 8 is silent", () => {
  const r = selectRung({ ...base, daysOverdue: 8, feeCount: 1, currentFee: 65 });
  assert.equal(r.event, null);
});

test("day 29 fires the final notice and the second 5%", () => {
  const r = selectRung({ ...base, daysOverdue: 29, feeCount: 1, currentFee: 65 });
  assert.equal(r.event, "INVOICE_FINAL_NOTICE");
  assert.equal(r.newFee, 65);
  assert.equal(r.newFeeCount, 2);
});

test("the second fee is charged once, not on every day past 29", () => {
  const r = selectRung({
    ...base,
    daysOverdue: 30,
    feeCount: 2,
    currentFee: 130,
    lastRemindedAtDays: 29,
  });
  assert.equal(r.event, null);
});

test("past the 30 day cap it becomes a conversation, not an email", () => {
  const r = selectRung({ ...base, daysOverdue: 31, feeCount: 2, currentFee: 130 });
  assert.equal(r.event, null);
  assert.equal(r.reason, "past_cap");
});

test("a rung already sent today does not re-send", () => {
  const r = selectRung({ ...base, daysOverdue: 3, lastRemindedAtDays: 3 });
  assert.equal(r.event, null);
});

test("nothing outstanding means nothing chased", () => {
  const r = selectRung({ ...base, daysOverdue: 9, outstanding: 0 });
  assert.equal(r.event, null);
  assert.equal(r.reason, "nothing_outstanding");
});

// A partial payment shrinks the base the 5% is taken from. Charging the fee on
// the original rent instead would overcharge anyone who paid most of it.
test("the fee is 5% of what is still outstanding, not of the original rent", () => {
  const r = selectRung({ ...base, daysOverdue: 5, outstanding: 300 });
  assert.equal(r.newFee, 15);
});
