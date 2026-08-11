// src/lib/partnerPins.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  isPinShaped, mayAttribute, validatePinUse, attributionFor, commissionFor,
} from "./partnerPins.js";

test("a PIN is six digits and nothing else", () => {
  // The real ones in production.
  for (const p of ["950348", "591886", "179840", "946408", "718672", "840973"]) {
    assert.equal(isPinShaped(p), true, p);
  }
  assert.equal(isPinShaped("95034"), false);
  assert.equal(isPinShaped("9503481"), false);
  assert.equal(isPinShaped("95034a"), false);
  assert.equal(isPinShaped(""), false);
  assert.equal(isPinShaped(null), false);
  assert.equal(isPinShaped(" 950348 "), true, "surrounding space is a typo, not a different PIN");
});

test("a partner key cannot claim another channel's commission", () => {
  const partner = { scope: "partner" };
  const internal = { scope: "internal" };
  assert.equal(mayAttribute(partner), false);
  assert.equal(mayAttribute(internal), true);

  const refused = validatePinUse("950348", partner);
  assert.equal(refused.ok, false);
  assert.equal(refused.status, 403);

  assert.equal(validatePinUse("950348", internal).ok, true);
  assert.equal(validatePinUse("950348", internal).pin, "950348");
});

test("a bad PIN is refused loudly, never dropped quietly", () => {
  // The whole reason this is not a silent no-op: a dropped PIN is a
  // commission that vanishes, discovered weeks later with nothing to
  // point at.
  const bad = validatePinUse("12345", { scope: "internal" });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 422);
  assert.match(bad.reason, /six digits/);

  // No PIN at all is not an error; most bookings have none.
  const none = validatePinUse(null, { scope: "partner" });
  assert.equal(none.ok, true);
  assert.equal(none.pin, null);
  assert.equal(validatePinUse("   ", { scope: "partner" }).ok, true);
});

test("the agent's channel wins over the calling key's channel", () => {
  const calling = { id: "channel-internal", slug: "internal" };
  const pinRow = { channel_id: "channel-agent", label: "Riko, Riko Property" };

  assert.deepEqual(attributionFor(null, calling),
    { channel_id: "channel-internal", attributed_via: "key" });
  assert.deepEqual(attributionFor(pinRow, calling),
    { channel_id: "channel-agent", attributed_via: "pin", attributed_to: "Riko, Riko Property" });
});

test("commission is quoted from the channel, and unknown is not zero", () => {
  assert.equal(commissionFor(null), null);
  // Every agent channel in production currently has commission_pct null and
  // commission_months 1. Reporting that as 0% would be a number somebody
  // could act on, and it would be wrong.
  assert.equal(commissionFor({ commission_pct: null, commission_months: 1, fee_fixed: null }), null);
  assert.deepEqual(commissionFor({ commission_pct: 50, commission_months: 1, fee_fixed: null, gross_up: false }),
    { pct: 50, months: 1, fee_fixed: null, gross_up: false });
  assert.deepEqual(commissionFor({ commission_pct: null, commission_months: null, fee_fixed: 300, gross_up: true }),
    { pct: null, months: null, fee_fixed: 300, gross_up: true });
});
