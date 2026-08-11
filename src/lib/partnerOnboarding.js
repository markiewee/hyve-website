// src/lib/partnerOnboarding.js
//
// The read side of the onboarding ops lane. onboarding_progress has been
// complete and unwatched since it was built: every step carries a
// timestamp, the portal fills them in honestly, and nothing asked the one
// question that matters, which is who stopped and how long ago.
//
// Asking it for the first time found two tenants who moved in on 15 June
// and never finished, one still without a signed tenancy agreement, and two
// tenancies that began on 1 August with the deposit unpaid. None of it was
// hidden. It was never read.
//
// The urgency ordering lives in the SQL view (v_onboardings_stuck) so the
// API and any dashboard cannot disagree about what is urgent. This file
// owns the shape that leaves the building, and what must not.

export const URGENCY_ORDER = ["CRITICAL", "HIGH", "NORMAL", "FRESH"];

export function urgencyRank(u) {
  const i = URGENCY_ORDER.indexOf(String(u ?? "").toUpperCase());
  return i === -1 ? URGENCY_ORDER.length : i;
}

// Worst first, and within a band the one that has been still longest. A
// list sorted by date alone buries a tenant living without an agreement
// under a queue of people who are merely slow.
export function sortOnboardings(rows) {
  return [...(rows ?? [])].sort((a, b) =>
    urgencyRank(a.urgency) - urgencyRank(b.urgency) ||
    (b.days_since_moved ?? 0) - (a.days_since_moved ?? 0));
}

// A stalled step is only actionable if you can say what unsticks it, so the
// API answers that rather than making every caller keep its own mapping.
const NEXT_ACTION = {
  PERSONAL_DETAILS: "ask them to finish their details in the portal",
  ID_VERIFICATION: "chase the ID or passport upload",
  SIGN_TA: "send the agreement for signature",
  DEPOSIT: "chase the deposit",
  HOUSE_RULES: "ask them to acknowledge the house rules",
  MOVE_IN_CHECKLIST: "walk the room and complete the checklist",
  WELCOME: "send the welcome pack and door code",
};

export function nextActionFor(step) {
  return NEXT_ACTION[String(step ?? "").toUpperCase()] ?? "find out what they are waiting on";
}

// The tenant's name and room go out, because a chaser cannot chase an
// anonymous row. Nothing else about the person does: no user id, no
// signature, no stripe session, no document urls. An internal key is not a
// reason to hand over a tenancy file.
export function onboardingView(row) {
  return {
    id: row.id,
    listing_code: row.listing_code ?? null,
    tenant_name: row.tenant_name ?? null,
    status: row.status ?? null,
    current_step: row.current_step ?? null,
    urgency: row.urgency ?? null,
    next_action: nextActionFor(row.current_step),
    tenancy_start_date: row.tenancy_start_date ?? null,
    tenancy_already_started: Boolean(row.tenancy_already_started),
    days_since_moved: row.days_since_moved ?? null,
    deposit_amount: row.deposit_amount ?? null,
    deposit_verified: Boolean(row.deposit_verified),
    updated_at: row.updated_at ?? null,
  };
}
