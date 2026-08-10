// Run with: node --test src/lib/staffPin.test.js
//
// A gate that forgets too fast is a gate people prop open. One that never
// forgets is one you cannot revoke. The expiry is the whole design, so it is
// the part worth testing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readUnlock, buildUnlock, UNLOCK_DAYS } from "./staffPin.js";

const NOW = new Date("2026-08-13T09:00:00Z").getTime();
const day = 86400000;

test("a fresh unlock is valid", () => {
  assert.equal(readUnlock(JSON.stringify(buildUnlock(NOW)), NOW), true);
});

test("an unlock is still valid one hour before it expires", () => {
  const u = JSON.stringify(buildUnlock(NOW));
  assert.equal(readUnlock(u, NOW + UNLOCK_DAYS * day - 3600000), true);
});

test("an unlock is dead once past its expiry", () => {
  const u = JSON.stringify(buildUnlock(NOW));
  assert.equal(readUnlock(u, NOW + UNLOCK_DAYS * day + 1), false);
});

test("nothing stored means locked", () => {
  assert.equal(readUnlock(null, NOW), false);
  assert.equal(readUnlock("", NOW), false);
});

test("corrupt storage means locked, not a thrown error", () => {
  assert.equal(readUnlock("{not json", NOW), false);
  assert.equal(readUnlock(JSON.stringify({ nope: 1 }), NOW), false);
});

test("an expiry in the far future is not trusted on its own", () => {
  // Someone hand-editing localStorage can set any expiry they like. The gate is
  // a doormat, not a lock, but it should at least reject a payload that does not
  // carry the shape we wrote.
  assert.equal(readUnlock(JSON.stringify({ exp: NOW + 400 * day }), NOW), false);
});
