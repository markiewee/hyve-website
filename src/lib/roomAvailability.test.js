// Run with: node --test src/lib/roomAvailability.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeAvailability } from "./roomAvailability.js";
import { ROOMS } from "../data/lazybeeRooms.js";

const A = { code: "CP-MR", next: "2026-12-21" };
const B = { code: "IH-PR1", next: "2027-09-26" };

test("a live date replaces the static one", () => {
  const out = mergeAvailability([A, B], [{ unit_code: "CP-MR", next_available: "2027-01-05" }]);
  assert.equal(out[0].next, "2027-01-05");
  assert.equal(out[1], B);
});

test("a failed or empty call leaves the static dates alone", () => {
  for (const rows of [null, undefined, [], "oops", {}]) {
    const rooms = [A, B];
    assert.equal(mergeAvailability(rooms, rows), rooms);
  }
});

test("null, malformed or unknown rows keep the static date", () => {
  const out = mergeAvailability([A, B], [
    { unit_code: "CP-MR", next_available: null },
    { unit_code: "IH-PR1", next_available: "26 Sep 2027" },
    { unit_code: "NOPE-1", next_available: "2027-01-01" },
    null,
  ]);
  assert.deepEqual(out, [A, B]);
});

test("the static record is not mutated", () => {
  const before = JSON.stringify(ROOMS);
  mergeAvailability(ROOMS, ROOMS.map((r) => ({ unit_code: r.code, next_available: "2030-01-01" })));
  assert.equal(JSON.stringify(ROOMS), before);
});

test("every room keeps all its other fields", () => {
  const out = mergeAvailability(ROOMS, [{ unit_code: ROOMS[0].code, next_available: "2030-01-01" }]);
  assert.deepEqual({ ...out[0], next: ROOMS[0].next }, ROOMS[0]);
  assert.equal(out.length, ROOMS.length);
});
