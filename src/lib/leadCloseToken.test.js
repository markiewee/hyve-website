// Run with: node --test src/lib/leadCloseToken.test.js
//
// The token is the only thing between a public URL and anyone being able to
// close any lead by guessing an id, so it is signed rather than a raw uuid.
// The bare-id test is the one that matters: an unsigned id must not be
// accepted, or the signature is decoration.

import { test } from "node:test";
import assert from "node:assert/strict";
import { signLeadToken, verifyLeadToken } from "./leadCloseToken.js";

const SECRET = "test-secret";

test("a signed token round-trips to its lead id", () => {
  const t = signLeadToken("lead-123", SECRET);
  assert.equal(verifyLeadToken(t, SECRET), "lead-123");
});

test("a tampered signature is rejected", () => {
  const t = signLeadToken("lead-123", SECRET);
  assert.equal(verifyLeadToken(t.slice(0, -2) + "xx", SECRET), null);
});

test("a token signed with another secret is rejected", () => {
  assert.equal(verifyLeadToken(signLeadToken("lead-123", "other"), SECRET), null);
});

test("a bare lead id is not accepted as a token", () => {
  assert.equal(verifyLeadToken("lead-123", SECRET), null);
});

test("junk input is rejected rather than throwing", () => {
  for (const bad of ["", null, undefined, "a.b.c", "....", "%%%.%%%"]) {
    assert.equal(verifyLeadToken(bad, SECRET), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("a real uuid round-trips intact", () => {
  const id = "9f2a1c44-3d1e-4b2a-8c77-0a1b2c3d4e5f";
  assert.equal(verifyLeadToken(signLeadToken(id, SECRET), SECRET), id);
});

test("the token is url-safe", () => {
  const t = signLeadToken("9f2a1c44-3d1e-4b2a-8c77-0a1b2c3d4e5f", SECRET);
  assert.equal(t, encodeURIComponent(t));
});

// Swapping the payload of one token onto the signature of another must fail,
// otherwise a valid token for any lead becomes a valid token for every lead.
test("a signature cannot be reused across lead ids", () => {
  const a = signLeadToken("lead-aaa", SECRET);
  const b = signLeadToken("lead-bbb", SECRET);
  const spliced = a.split(".")[0] + "." + b.split(".")[1];
  assert.equal(verifyLeadToken(spliced, SECRET), null);
});
