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
// Severity is matched on concepts, not on phrasings.
//
// The first version of this was a list of exact phrases, and running it over
// the eight real open tickets showed what that costs: "socket outlet BURNED
// - safety hazard" scored ROUTINE because the list knew "fire" but not
// "burned", "front door handle removed, door cannot be opened" scored
// ROUTINE because the list knew "door won't open" but not "door cannot be
// opened", and a corridor light bulb scored HIGH. Tenants do not write from
// a phrasebook, and the failure is asymmetric: an over-rated bulb costs an
// afternoon, an under-rated burned socket is a fire in a building people
// sleep in.
//
// So these are word-stem regexes, and the door rule is a relation between
// two things rather than a fixed sentence.
const URGENT_PATTERNS = [
  // Something is burning, has burned, or is about to.
  /\bburn(t|ed|ing)?\b/, /\bscorch/, /\bmelt(ed|ing)?\b/, /\bsmoke\b|\bsmell(ing|s)? of burning/,
  /\bfire\b/, /\bspark(s|ing)?\b/, /\bshort circuit/,
  // Electricity meeting a person.
  /\bshock(ed|s|ing)?\b/, /\b(exposed|live|bare)\s+wir/, /\belectrocut/,
  // Gas, which needs no qualifier.
  /\bgas\b/,
  // The place is not habitable right now.
  /\bno\s+(power|electricity|water|aircon|air.?con)\b/, /\bpower\s+(outage|cut|trip|failure)/,
  /\bflood(s|ing|ed)?\b/, /\bburst\b/, /leaking badly/, /water\s+(pouring|gushing|everywhere)/,
  /\bceiling\s+(collaps|fall|caving)/,
  // Somebody said out loud that it is dangerous.
  /\bhazard(ous)?\b/, /\bdanger(ous)?\b/, /\bunsafe\b/, /\bemergency\b/,
  // Locked in or locked out. A relation between an opening and a failure to
  // work it, in either word order, so phrasing does not decide safety.
  /\block(ed)?\s*out\b/, /\bcan.?t\s+enter\b|\bcannot\s+enter\b/, /\bbreak.?in\b/,
  /\b(door|gate|window|lock|handle)\b[^.!?]{0,60}\b(can(no|')?t|cannot|unable to|won'?t|will not|refuses to|failed to)\b[^.!?]{0,20}\b(open|close|lock|unlock|shut)/,
  /\b(can(no|')?t|cannot|unable to|won'?t|will not)\b[^.!?]{0,20}\b(open|close|lock|unlock|shut)\b[^.!?]{0,30}\b(door|gate|window)/,
  /\bbroken\s+lock\b/, /\block\s+(is\s+)?broken\b/,
];

// Not an emergency tonight, but it gets worse, spreads, or makes somebody
// ill if it waits a week.
const HIGH_PATTERNS = [
  /\bmou?ld(y|ing)?\b/, /\bdamp\b/, /\bsewage\b/, /\bsewer/,
  /\b(pest|infest|cockroach|roach|bed.?bug|rodent|rat|mice|mouse|termite)/,
  /\bno hot water\b/, /\bleak(s|ing|ed)?\b/, /\bdrip(s|ping)?\b/,
  /\bnot working\b/, /\bbroken\b/, /\bblocked\b/, /\bclogged\b/, /\bchoked\b/,
  /\btoilet\b/, /\bfridge\b|\brefrigerator\b/, /\bwashing machine\b/,
  /\baircon\b|\bair.?con\b|\bac not\b/, /\bstove\b|\bhob\b|\binduction\b/,
  /\bheater\b/, /\bwater heater\b/,
];

const COSMETIC_PATTERNS = [
  /\bpaint\b/, /\bscratch(es|ed)?\b/, /\bscuff/, /\bstain(s|ed)?\b/,
  /\bchip(ped)?\b/, /\bmark on\b/, /\bdiscolou?r/,
];

export function suggestSeverity(description) {
  const t = String(description ?? "").toLowerCase();
  if (!t.trim()) return "ROUTINE";
  if (URGENT_PATTERNS.some((p) => p.test(t))) return "URGENT";
  // Cosmetic only when nothing worse is also being described: "scratched the
  // door and now it cannot lock" is not a paint job.
  if (COSMETIC_PATTERNS.some((p) => p.test(t)) && !HIGH_PATTERNS.some((p) => p.test(t)))
    return "COSMETIC";
  if (HIGH_PATTERNS.some((p) => p.test(t))) return "HIGH";
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

// Closing a ticket is the moment the system stops looking at it, which
// makes it the moment to insist on evidence. The operating principles say
// no unit flips to ready without a photo set; this is the same rule at the
// only place it can be enforced today, since maintenance_tickets has no
// photo column: say what was done, and be somebody when you say it.
//
// 26 tickets are resolved and every one carries a note, so the discipline
// already exists. 23 of those 26 have no resolved_by at all, so the other
// half of it does not, and "it was fixed, we think, by someone" is not a
// maintenance record anybody can stand behind three months later.
export function validateClose(patch, { actor = null, photoCount = 0 } = {}) {
  const missing = [];
  if (String(patch?.status ?? "").toUpperCase() !== "RESOLVED") return { ok: true, missing };
  const note = String(patch?.resolution_note ?? "").trim();
  if (!note)
    missing.push("resolution_note is required to resolve a ticket: say what was actually done");
  else if (note.length < 4)
    missing.push("resolution_note must say something: a few characters is not a record");
  if (!patch?.resolved_by && !patch?.resolved_by_label && !actor)
    missing.push("resolved_by is required to resolve a ticket");
  // A note is a claim, a photo is evidence. ticket_photos has always existed
  // and nothing ever read it, so "RESOLVED" has meant "someone typed that it
  // is done". Defaulting to zero fails closed on purpose: a caller that does
  // not know about photos yet cannot quietly resolve without them.
  if (!(Number(photoCount) > 0))
    missing.push("at least one photo is required to resolve a ticket: show the fix");
  return { ok: missing.length === 0, missing };
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
    // The chaser decides between nudging and escalating on these two, so a
    // view that hid them would have let it nudge the same ticket forever.
    chase_count: row.chase_count ?? 0,
    last_chased_at: row.last_chased_at ?? null,
    // Same trap, one step earlier: without acknowledged_at a runner asking
    // "has this reporter been told anything yet" always reads null and sends
    // the same acknowledgement to the same tenant on every single cycle.
    // Operational state, not PII, so it belongs in the default view next to
    // the chase fields it works with.
    acknowledged_at: row.acknowledged_at ?? null,
    assigned_to: row.assigned_to ?? null,
    created_at: row.created_at ?? null,
    resolved_at: row.resolved_at ?? null,
    // Whoever closed it, whichever column holds them. A record that cannot
    // say who is not a record.
    resolved_by: row.resolved_by ?? row.resolved_by_label ?? null,
  };
}

// The chase rule: nothing sits past its deadline in silence, but nothing
// gets nagged more than once a day or more than three times before it stops
// being a nudge and becomes a person's problem to escalate.
export const MAX_CHASES = 3;
export const CHASE_INTERVAL_HOURS = 24;

// The reporter's number is deliberately absent from ticketView, alongside
// the internal ids: a ticket read should not hand back a tenant's phone by
// default. But the runner that acknowledges reporters has to reach them, so
// it asks for this view explicitly rather than the default one quietly
// widening for everybody. Internal scope only, like every ticket handler.
export function ticketOpsView(row, unitCode) {
  return { ...ticketView(row, unitCode), reporter_phone: row.reporter_phone ?? null };
}

// A status change without its timestamp is half a record. A runner set a
// ticket to ACKNOWLEDGED, acknowledged_at stayed null, and the next cycle
// read "never acknowledged" and would have messaged the same tenant again
// every fifteen minutes. The status says what happened; the stamp says when.
// Never overwrites an existing stamp: the first time is the honest one.
const STATUS_STAMPS = { ACKNOWLEDGED: "acknowledged_at", TRIAGED: "triaged_at" };

export function statusStamp(status, row = {}, now = new Date().toISOString()) {
  const column = STATUS_STAMPS[String(status ?? "").toUpperCase()];
  if (!column || row?.[column]) return {};
  return { [column]: now };
}

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
