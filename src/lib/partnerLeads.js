// src/lib/partnerLeads.js
//
// The CRM write path's pure half. Same philosophy as partnerBookings: the
// validation and the output shape are testable without a database, and
// leadView asserts its key set so a phone number, an internal note or a
// channel id can never leak into a partner's response by accident.
//
// The one rule the whole CRM hangs on is "the phone number is the person",
// so normalisePhone is the most important function in this file. It is a
// deliberate mirror of public.fn_normalise_phone in
// 20260816000000_crm_write_path.sql: if these two ever disagree, the API
// and the database will disagree about who somebody is, and two humans get
// merged into one row. The tests pin the same cases the SQL was written
// against, including the WhatsApp LID privacy identifiers that live in the
// production `leads` table and look enough like phone numbers to be
// dangerous (90070873755, 305823417484).

// Conservative on purpose: anything this cannot vouch for returns null
// rather than a guess. An unmatched lead is a nuisance; a wrongly matched
// lead is two different prospects sharing one row.
export function normalisePhone(raw) {
  if (raw == null) return null;
  const d = String(raw).replace(/[^0-9+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) return d.length >= 8 && d.length <= 16 ? d : null;
  if (d.length === 8 && "689".includes(d[0])) return "+65" + d;
  if (d.length === 10 && d.startsWith("65") && "689".includes(d[2])) return "+" + d;
  if (d.length >= 11 && d.length <= 12 && d.startsWith("60")) return "+" + d;
  return null;
}

// Mirrors leads_status_check. Kept as data so the router can reject an
// unknown status with the list instead of letting Postgres raise a 500.
export const LEAD_STATUSES = new Set([
  "new", "qualified", "viewing_booked", "viewed", "viewing_done",
  "agreement_sent", "signed", "closed_won", "lost", "closed_lost", "cold",
]);

export const LEAD_LIFECYCLES = new Set(["ACTIVE", "STORED"]);
export const LEAD_ROLES = new Set(["prospect", "tenant", "AGENT"]);

// A stored lead carries a typed condition a nightly sweep can evaluate.
// "Follow up later" is not a condition; it is a wish.
export const ACTIVATION_TYPES = new Set(["DATE", "ROOM", "BUDGET", "MANUAL"]);

export function validateActivation(cond) {
  if (cond == null) return { ok: true };
  if (typeof cond !== "object" || Array.isArray(cond))
    return { ok: false, reason: "activation_condition must be an object" };
  const type = String(cond.type ?? "").toUpperCase();
  if (!ACTIVATION_TYPES.has(type))
    return { ok: false, reason: `activation_condition.type must be one of: ${[...ACTIVATION_TYPES].join(", ")}` };
  if (type === "DATE" && !isIsoDate(cond.on))
    return { ok: false, reason: "activation_condition.on must be an ISO date for type DATE" };
  if (type === "ROOM" && !cond.listing_code)
    return { ok: false, reason: "activation_condition.listing_code is required for type ROOM" };
  if (type === "BUDGET" && !(Number(cond.max_monthly) > 0))
    return { ok: false, reason: "activation_condition.max_monthly must be a positive number for type BUDGET" };
  return { ok: true };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(s) {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// A lead needs a name and at least one way to reach the person again.
// A row with neither is an anonymous sighting, not a lead, and filing it
// makes the CRM's headline count a lie.
//
// "A way to reach them" is deliberately wider than "a dialable number". A
// platform thread often yields only a WhatsApp LID or a marketplace handle,
// and that is still the thread we reply on. Rejecting those would drop
// exactly the leads the platform bots are there to catch, so a raw phone
// value counts as a handle even when it does not normalise; the write path
// files it as an alias and leaves the key column null.
export function validateLead(body) {
  const b = body ?? {};
  const missing = [];
  if (!b.name || !String(b.name).trim()) missing.push("name");
  const hasHandle = Boolean(
    (b.phone != null && String(b.phone).trim()) || b.chat_id || b.email ||
    (Array.isArray(b.identifiers) && b.identifiers.length));
  if (!hasHandle) missing.push("one of: phone, chat_id, email, identifiers[]");
  if (b.status != null && !LEAD_STATUSES.has(b.status))
    missing.push(`status must be one of: ${[...LEAD_STATUSES].join(", ")}`);
  if (b.lifecycle != null && !LEAD_LIFECYCLES.has(b.lifecycle))
    missing.push("lifecycle must be ACTIVE or STORED");
  if (b.role != null && !LEAD_ROLES.has(b.role))
    missing.push(`role must be one of: ${[...LEAD_ROLES].join(", ")}`);
  for (const f of ["move_in", "move_out"]) {
    if (b[f] != null && !isIsoDate(b[f])) missing.push(`${f} must be an ISO date (YYYY-MM-DD)`);
  }
  if (b.budget_monthly != null && !(Number(b.budget_monthly) >= 0))
    missing.push("budget_monthly must be a number");
  if (b.occupants != null && !(Number.isInteger(Number(b.occupants)) && Number(b.occupants) > 0))
    missing.push("occupants must be a whole number above zero");
  const act = validateActivation(b.activation_condition);
  if (!act.ok) missing.push(act.reason);
  if (String(b.lifecycle) === "STORED" && b.activation_condition == null)
    missing.push("a STORED lead needs an activation_condition");
  return { ok: missing.length === 0, missing };
}

// The row a write should produce. Undefined keys are stripped by the caller
// so a partial update never blanks a field the caller did not mention: the
// brain sends what it learned in one thread, not the whole person.
export function leadPatch(body, { channelId = null, now = new Date().toISOString() } = {}) {
  const b = body ?? {};
  const phone = normalisePhone(b.phone);
  const patch = {
    name: b.name?.trim(),
    phone: b.phone ?? undefined,
    phone_e164: phone ?? undefined,
    email: b.email ?? undefined,
    chat_id: b.chat_id ?? undefined,
    source: b.source ?? undefined,
    status: b.status ?? undefined,
    lifecycle: b.lifecycle ?? undefined,
    activation_condition: b.activation_condition ?? undefined,
    budget_monthly: b.budget_monthly ?? undefined,
    move_in: b.move_in ?? undefined,
    move_out: b.move_out ?? undefined,
    occupants: b.occupants ?? undefined,
    location_preference: b.location_preference ?? undefined,
    role: b.role ?? undefined,
    next_action: b.next_action ?? undefined,
    next_action_due: b.next_action_due ?? undefined,
    property_interest: Array.isArray(b.property_interest) ? b.property_interest : undefined,
    matched_room_codes: Array.isArray(b.matched_room_codes)
      ? b.matched_room_codes.map((c) => String(c).trim().toUpperCase()) : undefined,
    prospect_summary: b.prospect_summary ?? undefined,
    notes: b.notes ?? undefined,
    channel_id: channelId ?? undefined,
    idempotency_key: b.idempotency_key ?? undefined,
    last_message_at: b.last_message_at ?? undefined,
    updated_at: now,
  };
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];
  return patch;
}

// Identifiers accumulate rather than replace: a person picks up handles over
// time (a Carousell username, then a LID, then a real number) and losing the
// old one breaks the next match. Deduped and order-stable so the column does
// not churn on every write.
export function mergeIdentifiers(existing, incoming) {
  const out = [];
  for (const v of [...(existing ?? []), ...(incoming ?? [])]) {
    const s = String(v ?? "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export function leadView(row) {
  return {
    id: row.id,
    name: row.name ?? null,
    phone: row.phone_e164 ?? row.phone ?? null,
    email: row.email ?? null,
    status: row.status ?? null,
    lifecycle: row.lifecycle ?? null,
    role: row.role ?? null,
    activation_condition: row.activation_condition ?? null,
    budget_monthly: row.budget_monthly ?? null,
    move_in: row.move_in ?? null,
    occupants: row.occupants ?? null,
    property_interest: row.property_interest ?? [],
    matched_room_codes: row.matched_room_codes ?? [],
    next_action: row.next_action ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}
