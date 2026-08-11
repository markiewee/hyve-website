// src/lib/partnerAuth.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { mintKey, hashKey, parseAuthHeader, allowRequest } from "./partnerAuth.js";

test("mintKey produces the documented format and 256 bits of entropy", () => {
  const k = mintKey();
  assert.match(k, /^lzb_live_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(mintKey(), k);
});

test("hashKey is a stable sha256 hex of the full key string", () => {
  const h = hashKey("lzb_live_abc");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashKey("lzb_live_abc"));
  assert.notEqual(h, hashKey("lzb_live_abd"));
});

test("parseAuthHeader accepts only a well-formed bearer key", () => {
  assert.equal(parseAuthHeader("Bearer lzb_live_x"), "lzb_live_x");
  assert.equal(parseAuthHeader("bearer lzb_live_x"), "lzb_live_x");
  assert.equal(parseAuthHeader("Bearer sk_other"), null);
  assert.equal(parseAuthHeader(""), null);
  assert.equal(parseAuthHeader(undefined), null);
});

test("allowRequest judges the post-increment slot number", () => {
  // `used` is count AFTER the atomic bump: request #1 of the minute is 1.
  assert.equal(allowRequest(1, 60), true);
  assert.equal(allowRequest(60, 60), true);   // the 60th request is inside 60/min
  assert.equal(allowRequest(61, 60), false);  // the 61st is not
  assert.equal(allowRequest(NaN, 60), false); // a broken count never opens the gate here
});
