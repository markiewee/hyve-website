// Run with: node --test src/lib/staffGreeting.test.js
//
// The boundaries are the whole of the logic, so they are the whole of the test.
// Local time on purpose: new Date(y, m, d, h) builds in the runner's zone, which
// is what getHours reads, so these assertions hold wherever they run.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  greetingKey,
  GREETING_KEYS,
  tourSeen,
  buildTourSeen,
  TOUR_STEPS,
} from "./staffGreeting.js";

const at = (h, m = 0) => new Date(2026, 7, 11, h, m);

test("midnight through to noon is morning", () => {
  assert.equal(greetingKey(at(0)), GREETING_KEYS.morning);
  assert.equal(greetingKey(at(6, 30)), GREETING_KEYS.morning);
  assert.equal(greetingKey(at(11, 59)), GREETING_KEYS.morning);
});

test("noon turns it over to afternoon", () => {
  assert.equal(greetingKey(at(12)), GREETING_KEYS.afternoon);
  assert.equal(greetingKey(at(17, 59)), GREETING_KEYS.afternoon);
});

test("six in the evening turns it over again", () => {
  assert.equal(greetingKey(at(18)), GREETING_KEYS.evening);
  assert.equal(greetingKey(at(23, 59)), GREETING_KEYS.evening);
});

test("every hour of the day resolves to exactly one greeting", () => {
  const seen = new Set();
  for (let h = 0; h < 24; h++) seen.add(greetingKey(at(h)));
  assert.equal(seen.size, 3);
  for (const k of seen) assert.ok(Object.values(GREETING_KEYS).includes(k));
});

test("the tour flag round-trips", () => {
  assert.equal(tourSeen(buildTourSeen()), true);
});

test("anything unreadable counts as not yet seen", () => {
  // Better to repeat the tour than to swallow it on a stray value.
  assert.equal(tourSeen(null), false);
  assert.equal(tourSeen(""), false);
  assert.equal(tourSeen("not json"), false);
  assert.equal(tourSeen("{}"), false);
  assert.equal(tourSeen('{"seen":"yes"}'), false);
});

test("there are five steps and they are distinct", () => {
  assert.equal(TOUR_STEPS.length, 5);
  assert.equal(new Set(TOUR_STEPS).size, 5);
});
