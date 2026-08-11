// src/lib/partnerCompliance.js
//
// The read side of the compliance lane. Nothing had ever asked what a
// current tenant is supposed to have on file against what they actually
// have, and the first run answered: 20 of 20 have a gap, 19 have no IRAS
// stamping recorded, and 7 have no signed agreement in either the document
// store or the onboarding table.
//
// The required set is config (public.compliance_requirements), not code,
// because it is policy: whether a short-stay guest needs stamping is a
// judgement, and the person who owns that judgement should be able to
// change it without a migration and a deploy. This file only shapes what
// leaves the building.

// What to do about each gap. A list of missing document kinds is a report;
// a list with the next move attached is a work queue.
const FIX = {
  AGREEMENT: "send the licence agreement for signature",
  ID: "ask for passport or NRIC and upload it to the portal",
  STAMPING: "stamp the agreement with IRAS and file the certificate",
};

export function fixFor(kind) {
  return FIX[String(kind ?? "").toUpperCase()] ?? `obtain ${kind}`;
}

// Worst first, then the biggest gap, then oldest tenancy. Somebody who has
// lived in a room for a year with no agreement should not sit below a
// tenant who moved in last week and is one document short.
const RANK = { CRITICAL: 0, HIGH: 1, NORMAL: 2, OK: 3 };

export function sortCompliance(rows) {
  return [...(rows ?? [])].sort((a, b) =>
    (RANK[a.urgency] ?? 9) - (RANK[b.urgency] ?? 9) ||
    (b.missing_count ?? 0) - (a.missing_count ?? 0) ||
    String(a.moved_in_at ?? "9999").localeCompare(String(b.moved_in_at ?? "9999")));
}

export function complianceView(row) {
  const missing = Array.isArray(row.missing) ? row.missing : [];
  return {
    listing_code: row.listing_code ?? null,
    tenant_name: row.tenant_name ?? null,
    urgency: row.urgency ?? null,
    missing,
    missing_count: row.missing_count ?? missing.length,
    required_count: row.required_count ?? null,
    next_actions: missing.map(fixFor),
    moved_in_at: row.moved_in_at ?? null,
  };
}

// A tenancy file is the most sensitive thing this company holds, so the id
// that addresses it never leaves. A caller gets the room and the name,
// which is all a chaser needs; anything more is a copy of somebody's
// passport waiting to happen.
export function complianceSummary(rows) {
  const out = { tenants: 0, with_gaps: 0, critical: 0, by_kind: {} };
  for (const r of rows ?? []) {
    out.tenants += 1;
    const missing = Array.isArray(r.missing) ? r.missing : [];
    if (missing.length) out.with_gaps += 1;
    if (r.urgency === "CRITICAL") out.critical += 1;
    for (const k of missing) out.by_kind[k] = (out.by_kind[k] ?? 0) + 1;
  }
  return out;
}
