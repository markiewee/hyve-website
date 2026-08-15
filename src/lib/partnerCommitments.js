// src/lib/partnerCommitments.js
//
// Promises, the pure half. Born from a specific failure: on 12 Aug we told
// tiff "we'll confirm timing for someone to come by asap" and nothing
// anywhere recorded that a promise had been made, so nothing chased it, and
// three days later the same AC was dripping onto a door lock. A promise made
// in chat is an obligation with a clock; this file gives it a shape the API
// can store and the nightly audit can read.

export function validateCommitment(body) {
  const missing = [];
  const promise = String(body?.promise ?? "").trim();
  if (!promise) missing.push("promise is required: what did we say we would do");
  else if (promise.length < 8)
    missing.push("promise must say something: a couple of characters is not a record");
  if (!body?.chat_id && !String(body?.counterparty ?? "").trim())
    missing.push("chat_id or counterparty is required: a promise nobody holds is unchaseable");
  if (body?.due_at != null && Number.isNaN(Date.parse(body.due_at)))
    missing.push("due_at must be an ISO timestamp when given");
  return { ok: missing.length === 0, missing };
}

export function commitmentView(row) {
  return {
    id: row.id,
    chat_id: row.chat_id ?? null,
    counterparty: row.counterparty ?? null,
    promise: row.promise,
    due_at: row.due_at ?? null,
    status: row.status,
    source: row.source ?? null,
    made_at: row.made_at ?? null,
    closed_at: row.closed_at ?? null,
    close_note: row.close_note ?? null,
  };
}

// No due date does not mean no clock. 24 hours is the same standard the
// loops board runs on: nothing sits in the same state for more than a day.
export const DEFAULT_GRACE_HOURS = 24;

export function isOverdue(row, nowIso = new Date().toISOString()) {
  if (!row || row.status !== "OPEN") return false;
  const now = Date.parse(nowIso);
  if (row.due_at) return Date.parse(row.due_at) < now;
  if (!row.made_at) return false;
  return Date.parse(row.made_at) + DEFAULT_GRACE_HOURS * 3600 * 1000 < now;
}
