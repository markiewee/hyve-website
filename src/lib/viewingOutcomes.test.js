// Run with: node --test src/lib/viewingOutcomes.test.js
//
// Tests for forced viewing outcomes.
// PRD: hyve-booking docs/superpowers/specs/2026-08-09-lead-capture-and-funnel-integrity-prd.md

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  needsOutcome,
  selectNeedsOutcome,
  outcomeUpdate,
  leadStatusForResult,
  OUTCOMES,
  ATTENDED_RESULTS,
} from "./viewingOutcomes.js";

const NOW = new Date("2026-08-09T12:00:00+08:00").getTime();
const PAST = "2026-08-01T14:00:00+08:00";
const FUTURE = "2026-08-20T14:00:00+08:00";

/* ── needsOutcome ── */

test("a past confirmed viewing needs an outcome", () => {
  assert.equal(needsOutcome({ slot_start: PAST, status: "confirmed" }, NOW), true);
});

test("a past pending viewing needs an outcome", () => {
  assert.equal(needsOutcome({ slot_start: PAST, status: "pending" }, NOW), true);
});

test("a future viewing does not need an outcome yet", () => {
  assert.equal(needsOutcome({ slot_start: FUTURE, status: "confirmed" }, NOW), false);
});

test("a viewing already resolved does not need an outcome", () => {
  for (const status of ["attended", "no_show", "cancelled"]) {
    assert.equal(needsOutcome({ slot_start: PAST, status }, NOW), false, status);
  }
});

test("status casing from the polling flow is handled", () => {
  assert.equal(needsOutcome({ slot_start: PAST, status: "CONFIRMED" }, NOW), true);
  assert.equal(needsOutcome({ slot_start: PAST, status: "CANCELLED" }, NOW), false);
});

test("falls back to viewing_date when slot_start is missing", () => {
  assert.equal(
    needsOutcome({ slot_start: null, viewing_date: "2026-08-01", status: "confirmed" }, NOW),
    true
  );
  assert.equal(
    needsOutcome({ slot_start: null, viewing_date: "2026-08-20", status: "confirmed" }, NOW),
    false
  );
});

test("a viewing with no date at all is not chased", () => {
  // 9 rows in production have neither field. Nagging about a viewing with no
  // date is noise, so they are left alone rather than shown forever.
  assert.equal(needsOutcome({ slot_start: null, viewing_date: null, status: "confirmed" }, NOW), false);
});

test("a viewing already stamped completed_at is done", () => {
  assert.equal(
    needsOutcome({ slot_start: PAST, status: "confirmed", completed_at: "2026-08-02T00:00:00Z" }, NOW),
    false
  );
});

/* ── selectNeedsOutcome ── */

test("selects only the ones needing an outcome, oldest first", () => {
  const rows = [
    { id: "future", slot_start: FUTURE, status: "confirmed" },
    { id: "older", slot_start: "2026-07-15T14:00:00+08:00", status: "confirmed" },
    { id: "newer", slot_start: PAST, status: "pending" },
    { id: "done", slot_start: PAST, status: "attended" },
  ];
  assert.deepEqual(
    selectNeedsOutcome(rows, NOW).map((r) => r.id),
    ["older", "newer"]
  );
});

test("selecting from an empty list is safe", () => {
  assert.deepEqual(selectNeedsOutcome([], NOW), []);
  assert.deepEqual(selectNeedsOutcome(null, NOW), []);
});

/* ── outcomeUpdate ── */

test("every outcome stamps completed_at", () => {
  // completed_at is what makes viewing-to-signed conversion computable.
  // It was null on all 69 production rows, so it must never be skipped.
  for (const o of OUTCOMES) {
    const patch = outcomeUpdate(o, NOW);
    assert.equal(patch.status, o);
    assert.ok(patch.completed_at, `${o} must stamp completed_at`);
    assert.equal(patch.completed_at, new Date(NOW).toISOString());
  }
});

test("an unknown outcome is rejected rather than written", () => {
  assert.throws(() => outcomeUpdate("maybe", NOW), /unknown outcome/i);
});

/* ── leadStatusForResult ── */

test("maps the attended follow-up onto lead statuses", () => {
  assert.equal(leadStatusForResult("signed"), "closed_won");
  assert.equal(leadStatusForResult("deciding"), "viewing_done");
  assert.equal(leadStatusForResult("not_interested"), "closed_lost");
});

test("every offered result maps to a lead status", () => {
  for (const r of ATTENDED_RESULTS) {
    assert.ok(leadStatusForResult(r.value), `${r.value} must map`);
  }
});

test("an unknown result does not silently change the lead", () => {
  assert.equal(leadStatusForResult("wat"), null);
});
