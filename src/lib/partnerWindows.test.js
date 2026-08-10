// src/lib/partnerWindows.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { unavailableWindows, calendarView } from "./partnerWindows.js";

const row = (starts_on, ends_on) => ({ starts_on, ends_on });

test("merges overlapping and adjacent blocking rows into one window", () => {
  const out = unavailableWindows(
    [row("2026-09-01", "2026-09-10"), row("2026-09-10", "2026-09-20"), row("2026-09-25", "2026-09-26")],
    { from: "2026-09-01", horizonDays: 60 }
  );
  assert.deepEqual(out, [
    { start: "2026-09-01", end: "2026-09-20" },
    { start: "2026-09-25", end: "2026-09-26" },
  ]);
});

test("null ends_on means occupied to the horizon", () => {
  const out = unavailableWindows([row("2026-09-01", null)], { from: "2026-08-15", horizonDays: 30 });
  assert.equal(out.length, 1);
  assert.equal(out[0].start, "2026-09-01");
  assert.equal(out[0].end, "2026-09-14"); // from + 30 days
});

test("windows before `from` are clipped, windows past horizon are clipped", () => {
  const out = unavailableWindows([row("2026-01-01", "2026-12-31")], { from: "2026-08-15", horizonDays: 10 });
  assert.deepEqual(out, [{ start: "2026-08-15", end: "2026-08-25" }]);
});

test("calendarView output carries ONLY start, end and status keys", () => {
  const view = calendarView(
    [{ starts_on: "2026-09-01", ends_on: "2026-09-10", kind: "TENANCY", source: "roomies", notes: "tenant Jane" }],
    { from: "2026-08-15", horizonDays: 90 }
  );
  for (const w of view) {
    assert.deepEqual(Object.keys(w).sort(), ["end", "start", "status"]);
    assert.ok(["open", "unavailable"].includes(w.status));
  }
});

test("calendarView interleaves open gaps between unavailable windows", () => {
  const view = calendarView([row("2026-09-01", "2026-09-10")], { from: "2026-08-15", horizonDays: 60 });
  assert.equal(view[0].status, "open");
  assert.equal(view[0].start, "2026-08-15");
  assert.equal(view[1].status, "unavailable");
  assert.equal(view[2].status, "open");
});
