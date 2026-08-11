// src/lib/partnerCompliance.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  sortCompliance, complianceView, complianceSummary, fixFor,
} from "./partnerCompliance.js";

test("no agreement outranks a longer list of smaller gaps", () => {
  const rows = [
    { listing_code: "CP-PR1", urgency: "HIGH", missing: ["ID", "STAMPING"], missing_count: 2 },
    { listing_code: "TG-STD2", urgency: "CRITICAL", missing: ["AGREEMENT", "ID", "STAMPING"], missing_count: 3 },
    { listing_code: "CP-PR2", urgency: "CRITICAL", missing: ["AGREEMENT", "STAMPING"], missing_count: 2 },
    { listing_code: "IH-STD1", urgency: "NORMAL", missing: ["ID"], missing_count: 1 },
  ];
  assert.deepEqual(sortCompliance(rows).map((r) => r.listing_code),
    ["TG-STD2", "CP-PR2", "CP-PR1", "IH-STD1"]);
  assert.equal(rows[0].listing_code, "CP-PR1", "must not mutate the caller's array");
});

test("within the same band, the longer tenancy is chased first", () => {
  const rows = [
    { listing_code: "NEW", urgency: "HIGH", missing_count: 2, moved_in_at: "2026-08-01" },
    { listing_code: "OLD", urgency: "HIGH", missing_count: 2, moved_in_at: "2025-03-01" },
  ];
  assert.deepEqual(sortCompliance(rows).map((r) => r.listing_code), ["OLD", "NEW"]);
  // A tenant with no move-in date recorded sorts last rather than first,
  // so a missing date cannot jump the queue ahead of a real one.
  const withUnknown = sortCompliance([
    { listing_code: "UNKNOWN", urgency: "HIGH", missing_count: 2 },
    { listing_code: "OLD", urgency: "HIGH", missing_count: 2, moved_in_at: "2025-03-01" },
  ]);
  assert.equal(withUnknown[0].listing_code, "OLD");
});

test("every gap comes with the move that closes it", () => {
  assert.match(fixFor("AGREEMENT"), /signature/i);
  assert.match(fixFor("ID"), /passport|NRIC/i);
  assert.match(fixFor("STAMPING"), /IRAS/i);
  assert.ok(fixFor("SOMETHING_ELSE").length > 0);

  const view = complianceView({
    listing_code: "TG-STD2", tenant_name: "Castro Carlisle", urgency: "CRITICAL",
    missing: ["AGREEMENT", "STAMPING"], missing_count: 2, required_count: 3,
    tenant_profile_id: "secret-uuid", moved_in_at: "2026-06-15",
  });
  assert.deepEqual(view.next_actions.length, 2);
  assert.match(view.next_actions[0], /signature/i);
  // The id that addresses a tenancy file never leaves.
  assert.ok(!("tenant_profile_id" in view));
  assert.deepEqual(Object.keys(view).sort(), [
    "listing_code", "missing", "missing_count", "moved_in_at", "next_actions",
    "required_count", "tenant_name", "urgency",
  ]);
});

test("the summary counts what needs chasing, by kind", () => {
  const s = complianceSummary([
    { urgency: "CRITICAL", missing: ["AGREEMENT", "STAMPING"] },
    { urgency: "HIGH", missing: ["ID", "STAMPING"] },
    { urgency: "OK", missing: [] },
  ]);
  assert.equal(s.tenants, 3);
  assert.equal(s.with_gaps, 2);
  assert.equal(s.critical, 1);
  assert.deepEqual(s.by_kind, { AGREEMENT: 1, STAMPING: 2, ID: 1 });
  assert.deepEqual(complianceSummary(null), { tenants: 0, with_gaps: 0, critical: 0, by_kind: {} });
  // A row whose missing list did not come back as an array must not crash
  // the summary; a compliance report that throws is a report nobody reads.
  assert.equal(complianceSummary([{ urgency: "OK", missing: null }]).tenants, 1);
});
