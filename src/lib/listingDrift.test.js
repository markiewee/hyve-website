// Run with: node --test src/lib/listingDrift.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { driftOf, rowStatus, sortRows } from "./listingDrift.js";

/* ── drift comparison ─────────────────────────────────────────────── */

test("no observation yet is unknown, not agreement", () => {
  const d = driftOf({ on: true, headline: "Available now" }, null);
  assert.equal(d.kind, "unknown");
});

test("same on-state and headline is agreement", () => {
  const d = driftOf({ on: true, headline: "Available from 12 Aug 2026" },
                    { on: true, headline: "Available from 12 Aug 2026" });
  assert.equal(d.kind, "match");
});

test("a differing headline is drift even when both are live", () => {
  const d = driftOf({ on: true, headline: "Available from 12 Aug 2026" },
                    { on: true, headline: "Available now" });
  assert.equal(d.kind, "drift");
  assert.deepEqual(d.fields, ["headline"]);
});

test("both fields differing reports both", () => {
  const d = driftOf({ on: true, headline: "Available now" },
                    { on: false, headline: null });
  assert.deepEqual(d.fields, ["on", "headline"]);
});

test("null and empty headline are the same thing, not drift", () => {
  const d = driftOf({ on: false, headline: null }, { on: false, headline: "" });
  assert.equal(d.kind, "match");
});

/* ── row status ───────────────────────────────────────────────────── */

test("disputed availability outranks drift, because we refuse to act on it", () => {
  assert.equal(
    rowStatus({ availability_disputed: true,
                desired: { on: true, headline: "x" }, observed_state: null }),
    "disputed");
});

test("a frozen placement reads as frozen, not as work to do", () => {
  assert.equal(
    rowStatus({ frozen_reason: "five consecutive failures, needs a human",
                desired: { on: true, headline: "x" },
                observed_state: { on: false, headline: null } }),
    "frozen");
});

test("an error outranks the drift it probably caused", () => {
  assert.equal(
    rowStatus({ last_error: "session expired",
                desired: { on: true, headline: "x" },
                observed_state: { on: false, headline: null } }),
    "error");
});

/* ── ordering ─────────────────────────────────────────────────────── */

test("rows needing attention sort above quiet ones", () => {
  const rows = [
    { unit_code: "A", desired: { on: true, headline: "x" }, observed_state: { on: true, headline: "x" } },
    { unit_code: "B", desired: { on: true, headline: "x" }, observed_state: { on: false, headline: null } },
    { unit_code: "C", availability_disputed: true, desired: { on: true, headline: "x" }, observed_state: null },
  ];
  assert.deepEqual(sortRows(rows).map((r) => r.unit_code), ["C", "B", "A"]);
});

test("sorting does not mutate the array it was given", () => {
  const rows = [
    { unit_code: "B", desired: { on: true, headline: "x" }, observed_state: { on: false, headline: null } },
    { unit_code: "A", desired: { on: true, headline: "x" }, observed_state: { on: true, headline: "x" } },
  ];
  sortRows(rows);
  assert.equal(rows[0].unit_code, "B");
});

test("ties break on unit code so the table does not reshuffle between loads", () => {
  const mk = (u) => ({ unit_code: u, desired: { on: true, headline: "x" },
                       observed_state: { on: true, headline: "x" } });
  assert.deepEqual(sortRows([mk("TG-PR1"), mk("CP-MR"), mk("IH-STD1")])
                     .map((r) => r.unit_code),
                   ["CP-MR", "IH-STD1", "TG-PR1"]);
});
