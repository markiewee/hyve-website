// src/lib/partnerOnboarding.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  sortOnboardings, urgencyRank, nextActionFor, onboardingView,
} from "./partnerOnboarding.js";

test("the worst thing is first, not the oldest thing", () => {
  // The real shape of the list the day this was written: an ID check stuck
  // 39 days, and a tenant who moved in on 15 June still without a signed
  // agreement at 24 days. Sorting by age alone puts the wrong one on top.
  const rows = [
    { listing_code: "TG-STD1", urgency: "HIGH", days_since_moved: 39 },
    { listing_code: "IH-PR2", urgency: "CRITICAL", days_since_moved: 34 },
    { listing_code: "TG-STD2", urgency: "CRITICAL", days_since_moved: 24 },
    { listing_code: "IH-STD4", urgency: "FRESH", days_since_moved: 0 },
    { listing_code: "CP-STD1", urgency: "HIGH", days_since_moved: 15 },
  ];
  assert.deepEqual(sortOnboardings(rows).map((r) => r.listing_code),
    ["IH-PR2", "TG-STD2", "TG-STD1", "CP-STD1", "IH-STD4"]);
  // Sorting must not mutate the caller's array.
  assert.equal(rows[0].listing_code, "TG-STD1");
  assert.deepEqual(sortOnboardings(null), []);
});

test("an unknown urgency sorts last instead of crashing or jumping the queue", () => {
  assert.ok(urgencyRank("WHATEVER") > urgencyRank("FRESH"));
  assert.equal(urgencyRank("critical"), 0);
  assert.equal(urgencyRank(null), urgencyRank("nonsense"));
});

test("every step says what would unstick it", () => {
  assert.match(nextActionFor("DEPOSIT"), /deposit/i);
  assert.match(nextActionFor("SIGN_TA"), /signature|agreement/i);
  assert.match(nextActionFor("ID_VERIFICATION"), /ID|passport/i);
  // An unknown step still gives the chaser something to do.
  assert.ok(nextActionFor("SOMETHING_NEW").length > 0);
  assert.ok(nextActionFor(null).length > 0);
});

test("onboardingView carries who and where, and no tenancy file", () => {
  const view = onboardingView({
    id: "1", listing_code: "TG-STD2", tenant_name: "Castro Carlisle",
    status: "ACTIVE", current_step: "SIGN_TA", urgency: "CRITICAL",
    tenancy_start_date: "2026-06-15", tenancy_already_started: true,
    days_since_moved: 24, deposit_amount: 700, deposit_verified: true,
    // None of the following may travel:
    tenant_profile_id: "secret", ta_signed_url: "https://.../signed.pdf",
    saved_signature: "data:image/png;base64,...",
    deposit_stripe_session_id: "cs_live_123", signature_positions: {},
  });
  assert.equal(view.listing_code, "TG-STD2");
  assert.equal(view.tenancy_already_started, true);
  assert.match(view.next_action, /signature|agreement/i);
  assert.deepEqual(Object.keys(view).sort(), [
    "current_step", "days_since_moved", "deposit_amount", "deposit_verified",
    "id", "listing_code", "next_action", "status", "tenancy_already_started",
    "tenancy_start_date", "tenant_name", "updated_at", "urgency",
  ]);
  for (const leak of ["ta_signed_url", "saved_signature", "tenant_profile_id",
                      "deposit_stripe_session_id", "signature_positions"]) {
    assert.ok(!(leak in view), `${leak} must never leave the building`);
  }
});
