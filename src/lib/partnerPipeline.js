// src/lib/partnerPipeline.js
//
// The stalled half of the CRM. 239 leads, no notion of a stage being
// overdue, so the table silts up: 122 sit at "qualified" with 53 untouched
// for over a week, and 19 of the 22 at "new" were never triaged at all. A
// prospect nobody moved is not a pipeline, it is a list.
//
// The patience per stage is config (public.lead_stage_policy), because how
// long to wait on a viewing is a commercial judgement and not a property of
// the code. This file decides what a caller sees and what it is told to do
// about it.

// Stages are not equally expensive to lose, so the queue is not sorted by
// age. A booked viewing with no outcome is our failure and the most costly
// thing here; a cold lead a month past its nudge is barely a task.
const STAGE_WEIGHT = {
  viewing_booked: 0,
  viewing_done: 1,
  agreement_sent: 2,
  signed: 3,
  qualified: 4,
  new: 5,
  cold: 6,
};

export function stageWeight(status) {
  return STAGE_WEIGHT[String(status ?? "").toLowerCase()] ?? 99;
}

export function sortStalled(rows) {
  return [...(rows ?? [])].sort((a, b) =>
    stageWeight(a.status) - stageWeight(b.status) ||
    (b.days_over ?? 0) - (a.days_over ?? 0));
}

// Mark's standing rule is that a prospect silent for about two days is
// closed rather than chased forever. This says which rows that applies to,
// and deliberately does NOT apply it: closing is a decision the caller
// makes, so a reporting endpoint can show the number without a read
// quietly rewriting 87 rows.
export function isAutoCloseable(row) {
  const status = String(row?.status ?? "").toLowerCase();
  if (status !== "new") return false;          // only an untouched first enquiry
  if ((row?.days_over ?? 0) < 1) return false;
  // Somebody who told us a budget or a room told us something. That is a
  // real prospect who deserves a human, not a silent close.
  if (row?.budget_monthly != null) return false;
  if (Array.isArray(row?.matched_room_codes) && row.matched_room_codes.length) return false;
  return true;
}

export function stalledView(row) {
  return {
    id: row.id,
    name: row.name ?? null,
    phone: row.phone_e164 ?? null,
    status: row.status ?? null,
    channel: row.channel ?? null,
    days_still: row.days_still ?? null,
    days_over: row.days_over ?? null,
    patience_days: row.patience_days ?? null,
    next_action: row.next_action ?? row.owner_hint ?? null,
    matched_room_codes: row.matched_room_codes ?? [],
    budget_monthly: row.budget_monthly ?? null,
    auto_closeable: isAutoCloseable(row),
  };
}

export function pipelineSummary(rows) {
  const out = { stalled: 0, by_status: {}, auto_closeable: 0, worst_days_over: 0 };
  for (const r of rows ?? []) {
    out.stalled += 1;
    out.by_status[r.status] = (out.by_status[r.status] ?? 0) + 1;
    if (isAutoCloseable(r)) out.auto_closeable += 1;
    if ((r.days_over ?? 0) > out.worst_days_over) out.worst_days_over = r.days_over ?? 0;
  }
  return out;
}
