/**
 * Forced viewing outcomes.
 *
 * Every one of the first 69 viewings had `completed_at` null, and 43 sat at
 * "confirmed" forever, including some whose date had passed weeks earlier. No
 * code path anywhere set `attended`, `no_show` or `completed_at`, so the
 * mechanism simply did not exist. That makes viewing-to-signed conversion,
 * the most important operating number in the business, impossible to compute.
 *
 * This module is the pure logic behind the "Needs outcome" queue: which
 * viewings are overdue an answer, what patch each answer writes, and how the
 * answer feeds back to the lead.
 */

/** The three answers a past viewing can be given. */
export const OUTCOMES = ["attended", "no_show", "cancelled"];

/** Follow-up asked only when the outcome is "attended". */
export const ATTENDED_RESULTS = [
  { value: "signed", label: "Signed" },
  { value: "deciding", label: "Still deciding" },
  { value: "not_interested", label: "Not interested" },
];

const RESULT_TO_LEAD_STATUS = {
  signed: "closed_won",
  deciding: "viewing_done",
  not_interested: "closed_lost",
};

/** Statuses that mean the viewing is already resolved. */
const RESOLVED = new Set(["attended", "no_show", "cancelled"]);

/**
 * When did (or will) this viewing happen? Prefers slot_start, falls back to
 * viewing_date. Returns null when the row carries neither, which is true of
 * 9 production rows and means we cannot judge whether it is overdue.
 */
function whenMs(v) {
  if (v?.slot_start) {
    const t = new Date(v.slot_start).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (v?.viewing_date) {
    // Date-only rows are treated as end-of-day SGT so a viewing is not chased
    // for an outcome on the morning of the day it is scheduled.
    const t = new Date(`${String(v.viewing_date).slice(0, 10)}T23:59:59+08:00`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/**
 * True when a viewing's time has passed and nobody has said what happened.
 * @param {object} v   a property_viewings row
 * @param {number} nowMs
 */
export function needsOutcome(v, nowMs = Date.now()) {
  if (!v) return false;
  if (v.completed_at) return false;

  // The status CHECK constraint only permits lower case, but several call
  // sites in the app compare against "CANCELLED" as well, so normalise rather
  // than trust the case we are handed.
  const status = String(v.status ?? "").toLowerCase();
  if (RESOLVED.has(status)) return false;

  const t = whenMs(v);
  if (t === null) return false;
  return t < nowMs;
}

/** Every viewing awaiting an outcome, oldest first so the worst offender leads. */
export function selectNeedsOutcome(viewings, nowMs = Date.now()) {
  if (!Array.isArray(viewings)) return [];
  return viewings
    .filter((v) => needsOutcome(v, nowMs))
    .sort((a, b) => (whenMs(a) ?? 0) - (whenMs(b) ?? 0));
}

/**
 * The patch to write for a chosen outcome. `completed_at` is always stamped:
 * it is the field that makes the funnel computable, so it is not optional and
 * not caller-supplied.
 */
export function outcomeUpdate(outcome, nowMs = Date.now()) {
  if (!OUTCOMES.includes(outcome)) {
    throw new Error(`unknown outcome: ${outcome}`);
  }
  return {
    status: outcome,
    completed_at: new Date(nowMs).toISOString(),
  };
}

/** Lead status implied by the attended follow-up, or null if we do not know. */
export function leadStatusForResult(result) {
  return RESULT_TO_LEAD_STATUS[result] ?? null;
}
