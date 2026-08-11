// src/lib/partnerPipeline.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  sortStalled, stageWeight, isAutoCloseable, stalledView, pipelineSummary,
} from "./partnerPipeline.js";

test("a viewing with no outcome outranks everything older", () => {
  // Age is the wrong sort. A booked viewing nobody recorded an outcome for
  // is our failure and the most expensive row here; a cold lead a month
  // past its nudge is barely a task, however old it is.
  const rows = [
    { status: "cold", days_over: 37 },
    { status: "new", days_over: 76 },
    { status: "viewing_booked", days_over: 2 },
    { status: "qualified", days_over: 73 },
  ];
  assert.deepEqual(sortStalled(rows).map((r) => r.status),
    ["viewing_booked", "qualified", "new", "cold"]);
  assert.equal(rows[0].status, "cold", "must not mutate the caller's array");
  assert.ok(stageWeight("something_new") > stageWeight("cold"));
});

test("auto-close only touches an untouched first enquiry", () => {
  // The rule is for dead first contacts, not for people who told us
  // something. A budget or a room means a real prospect, and closing that
  // silently would throw away a lead somebody worked for.
  assert.equal(isAutoCloseable({ status: "new", days_over: 5 }), true);
  assert.equal(isAutoCloseable({ status: "new", days_over: 0 }), false);
  assert.equal(isAutoCloseable({ status: "new", days_over: 5, budget_monthly: 1400 }), false);
  assert.equal(isAutoCloseable({ status: "new", days_over: 5, matched_room_codes: ["CP-MR"] }), false);
  assert.equal(isAutoCloseable({ status: "new", days_over: 5, matched_room_codes: [] }), true);
  // Never a later stage: somebody who booked a viewing is not a dead enquiry.
  assert.equal(isAutoCloseable({ status: "qualified", days_over: 73 }), false);
  assert.equal(isAutoCloseable({ status: "viewing_booked", days_over: 76 }), false);
  assert.equal(isAutoCloseable(null), false);
});

test("stalledView says what to do, and the summary counts it", () => {
  const view = stalledView({
    id: "1", name: "Jane", phone_e164: "+6591234567", status: "viewing_booked",
    days_still: 78, days_over: 76, patience_days: 2, owner_hint: "confirm, or record what happened",
    channel: "roomies",
  });
  assert.equal(view.next_action, "confirm, or record what happened");
  assert.equal(view.auto_closeable, false);
  // An explicit next_action on the lead beats the stage's generic hint.
  assert.equal(stalledView({ next_action: "call them back", owner_hint: "generic" }).next_action,
    "call them back");

  const s = pipelineSummary([
    { status: "new", days_over: 76 },
    { status: "new", days_over: 3, budget_monthly: 1200 },
    { status: "qualified", days_over: 73 },
  ]);
  assert.equal(s.stalled, 3);
  assert.equal(s.auto_closeable, 1, "the one with a budget is not auto-closeable");
  assert.equal(s.worst_days_over, 76);
  assert.deepEqual(s.by_status, { new: 2, qualified: 1 });
  assert.deepEqual(pipelineSummary(null),
    { stalled: 0, by_status: {}, auto_closeable: 0, worst_days_over: 0 });
});
