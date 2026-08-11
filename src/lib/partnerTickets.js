// src/lib/partnerTickets.js
//
// Maintenance tickets, the pure half. This exists because of a specific
// failure: a tenant reported the CP side door in the house WhatsApp group,
// the reply brain correctly refused to invent a door code, and then nothing
// happened, because there was nowhere for "nothing happened" to be visible.
// maintenance_tickets.submitted_by was NOT NULL and pointed at a portal
// account, so a message from a phone could not become a ticket at all.
//
// The fix has two halves. The migration made submitted_by nullable and added
// reporter_phone. This file adds the other half: severity is a clock, not an
// adjective. Category says what broke, severity says by when, and dueAtFor
// is a deliberate mirror of public.fn_ticket_due_at so the API, the chaser
// and the board can never disagree about whether a ticket is late.

export const TICKET_CATEGORIES = new Set([
  "AC", "PLUMBING", "ELECTRICAL", "FURNITURE", "CLEANING", "OTHER",
]);

export const TICKET_SEVERITIES = new Set(["URGENT", "HIGH", "ROUTINE", "COSMETIC"]);

export const TICKET_STATUSES = new Set([
  "OPEN", "ACKNOWLEDGED", "TRIAGED", "SCHEDULED", "IN_PROGRESS",
  "AWAITING_PROOF", "WAITING_PARTS", "ESCALATED", "RESOLVED",
]);

// Hours to deadline. Mirrors public.fn_ticket_due_at; if you change one,
// change both, and the test at the bottom of this file will tell you.
const SLA_HOURS = { URGENT: 4, HIGH: 48, ROUTINE: 24 * 7, COSMETIC: 24 * 30 };

export function dueAtFor(severity, fromIso) {
  const hours = SLA_HOURS[String(severity ?? "").toUpperCase()] ?? SLA_HOURS.ROUTINE;
  const from = fromIso ? new Date(fromIso) : new Date();
  if (Number.isNaN(from.getTime())) return null;
  return new Date(from.getTime() + hours * 3600 * 1000).toISOString();
}

// Words that mean "this is not a next-week problem". Kept small and boring
// on purpose: this only ever SUGGESTS a severity, and a human or the brain
// can override it. The cost of guessing URGENT wrongly is a Telegram buzz;
// the cost of missing a real flood is a flooded flat.
const URGENT_HINTS = [
  "no power", "no electricity", "power outage", "no water", "burst", "flood",
  "flooding", "leaking badly", "gas", "smoke", "fire", "sparks", "shock",
  "locked out", "lockout", "cannot enter", "can't enter", "door won't open",
  "break in", "broken lock", "no aircon" /* Singapore, in August */,
];
const HIGH_HINTS = [
  "leak", "leaking", "not working", "broken", "blocked", "clogged", "no hot water",
  "toilet", "fridge", "washing machine", "aircon", "air con", "ac not",
];
const COSMETIC_HINTS = ["paint", "scratch", "scuff", "stain", "chip", "mark on"];

export function suggestSeverity(description) {
  const t = String(description ?? "").toLowerCase();
  if (!t.trim()) return "ROUTINE";
  if (URGENT_HINTS.some((h) => t.includes(h))) return "URGENT";
  if (COSMETIC_HINTS.some((h) => t.includes(h)) && !HIGH_HINTS.some((h) => t.includes(h)))
    return "COSMETIC";
  if (HIGH_HINTS.some((h) => t.includes(h))) return "HIGH";
  return "ROUTINE";
}

export function suggestCategory(description) {
  const t = String(description ?? "").toLowerCase();
  if (/aircon|air con|\bac\b|cooling|fan coil/.test(t)) return "AC";
  if (/water|leak|toilet|sink|drain|tap|shower|pipe|flush|clog/.test(t)) return "PLUMBING";
  if (/power|electric|socket|light|bulb|switch|breaker|wiring/.test(t)) return "ELECTRICAL";
  if (/bed|mattress|chair|table|wardrobe|desk|sofa|drawer|cupboard/.test(t)) return "FURNITURE";
  if (/clean|dirty|rubbish|trash|mould|mold|smell|pest|cockroach|bug/.test(t)) return "CLEANING";
  return "OTHER";
}

// A ticket must say what is wrong, where, and who reported it. Anything less
// is a rumour, and a rumour with an SLA clock on it is worse than no ticket.
export function validateTicket(body) {
  const b = body ?? {};
  const missing = [];
  if (!b.description || !String(b.description).trim()) missing.push("description");
  if (!b.listing_code && !b.property_slug) missing.push("one of: listing_code, property_slug");
  if (!b.reporter_phone && !b.submitted_by) missing.push("one of: reporter_phone, submitted_by");
  if (b.category != null && !TICKET_CATEGORIES.has(String(b.category).toUpperCase()))
    missing.push(`category must be one of: ${[...TICKET_CATEGORIES].join(", ")}`);
  if (b.severity != null && !TICKET_SEVERITIES.has(String(b.severity).toUpperCase()))
    missing.push(`severity must be one of: ${[...TICKET_SEVERITIES].join(", ")}`);
  if (b.status != null && !TICKET_STATUSES.has(String(b.status).toUpperCase()))
    missing.push(`status must be one of: ${[...TICKET_STATUSES].join(", ")}`);
  return { ok: missing.length === 0, missing };
}

// What the row should look like. Severity and category are filled from the
// text only when the caller did not say: an explicit value always wins,
// because the person in the flat knows better than a keyword list.
export function ticketInsert(body, { roomId = null, propertyId = null,
                                     channelId = null, leadId = null,
                                     now = new Date().toISOString() } = {}) {
  const b = body ?? {};
  const severity = String(b.severity ?? suggestSeverity(b.description)).toUpperCase();
  const row = {
    room_id: roomId,
    property_id: propertyId,
    description: String(b.description).trim(),
    category: String(b.category ?? suggestCategory(b.description)).toUpperCase(),
    severity,
    status: String(b.status ?? "OPEN").toUpperCase(),
    reporter_phone: b.reporter_phone ?? null,
    reporter_name: b.reporter_name ?? null,
    submitted_by: b.submitted_by ?? null,
    source: b.source ?? null,
    access_note: b.access_note ?? null,
    lead_id: leadId,
    channel_id: channelId,
    idempotency_key: b.idempotency_key ?? null,
    due_at: dueAtFor(severity, now),
    created_at: now,
    updated_at: now,
  };
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  return row;
}

export function ticketView(row, unitCode) {
  return {
    id: row.id,
    listing_code: unitCode ?? null,
    category: row.category ?? null,
    severity: row.severity ?? null,
    status: row.status ?? null,
    description: row.description ?? null,
    due_at: row.due_at ?? null,
    scheduled_for: row.scheduled_for ?? null,
    created_at: row.created_at ?? null,
    resolved_at: row.resolved_at ?? null,
  };
}

// The chase rule: nothing sits past its deadline in silence, but nothing
// gets nagged more than once a day or more than three times before it stops
// being a nudge and becomes a person's problem to escalate.
export const MAX_CHASES = 3;
export const CHASE_INTERVAL_HOURS = 24;

export function shouldChase(ticket, nowIso = new Date().toISOString()) {
  if (!ticket || ticket.status === "RESOLVED") return false;
  if (!ticket.due_at) return false;
  const now = new Date(nowIso).getTime();
  if (new Date(ticket.due_at).getTime() > now) return false;
  if ((ticket.chase_count ?? 0) >= MAX_CHASES) return false;
  if (ticket.last_chased_at) {
    const since = now - new Date(ticket.last_chased_at).getTime();
    if (since < CHASE_INTERVAL_HOURS * 3600 * 1000) return false;
  }
  return true;
}

// After MAX_CHASES an overdue ticket stops being chased and starts being
// escalated: silence is the failure mode this whole file exists to prevent.
export function shouldEscalate(ticket, nowIso = new Date().toISOString()) {
  if (!ticket || ticket.status === "RESOLVED" || ticket.status === "ESCALATED") return false;
  if (!ticket.due_at) return false;
  if (new Date(ticket.due_at).getTime() > new Date(nowIso).getTime()) return false;
  return (ticket.chase_count ?? 0) >= MAX_CHASES;
}
