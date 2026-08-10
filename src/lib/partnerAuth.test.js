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

test("allowRequest is a strict under-limit check", () => {
  assert.equal(allowRequest(0, 60), true);
  assert.equal(allowRequest(59, 60), true);
  assert.equal(allowRequest(60, 60), false);
});
