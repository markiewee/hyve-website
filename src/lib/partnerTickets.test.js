// src/lib/partnerTickets.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  dueAtFor, suggestSeverity, suggestCategory, validateTicket, ticketInsert,
  ticketView, shouldChase, shouldEscalate, MAX_CHASES, validateClose,
} from "./partnerTickets.js";

const T0 = "2026-08-11T12:00:00.000Z";
const plusHours = (h) => new Date(Date.parse(T0) + h * 3600 * 1000).toISOString();

test("severity is a clock, and the hours match the SQL function", () => {
  assert.equal(dueAtFor("URGENT", T0), plusHours(4));
  assert.equal(dueAtFor("HIGH", T0), plusHours(48));
  assert.equal(dueAtFor("ROUTINE", T0), plusHours(24 * 7));
  assert.equal(dueAtFor("COSMETIC", T0), plusHours(24 * 30));
  // Unknown or missing severity falls back to ROUTINE rather than throwing:
  // a ticket with no deadline is exactly the thing that dies in silence.
  assert.equal(dueAtFor("SPICY", T0), plusHours(24 * 7));
  assert.equal(dueAtFor(null, T0), plusHours(24 * 7));
  assert.equal(dueAtFor("URGENT", "not a date"), null);
  assert.equal(dueAtFor("urgent", T0), plusHours(4), "case must not matter");
});

test("suggestSeverity catches the things that cannot wait", () => {
  assert.equal(suggestSeverity("There is no water in the whole unit"), "URGENT");
  assert.equal(suggestSeverity("I am locked out, the door won't open"), "URGENT");
  assert.equal(suggestSeverity("water is flooding the kitchen"), "URGENT");
  assert.equal(suggestSeverity("I smell gas"), "URGENT");
  assert.equal(suggestSeverity("no power in my room"), "URGENT");

  assert.equal(suggestSeverity("the toilet is blocked"), "HIGH");
  assert.equal(suggestSeverity("aircon not working"), "HIGH");
  assert.equal(suggestSeverity("small leak under the sink"), "HIGH");

  assert.equal(suggestSeverity("there is a scuff on the wall"), "COSMETIC");
  assert.equal(suggestSeverity("can I get a spare key sometime"), "ROUTINE");
  assert.equal(suggestSeverity(""), "ROUTINE");
  assert.equal(suggestSeverity(null), "ROUTINE");

  // A cosmetic word plus a real fault is still a real fault.
  assert.equal(suggestSeverity("paint is peeling and the pipe is leaking"), "HIGH");
});

test("severity reads real tenant sentences, not a phrasebook", () => {
  // Every string below is the real text of a ticket that was sitting open in
  // production, and every one of them was scored ROUTINE by the first
  // version of this function. That is the regression this test exists for.
  const real = [
    ["[Kitchen] Induction stove socket outlet BURNED — safety hazard, tenant told to stop using.", "URGENT"],
    ["[Door] Front door handle removed — door cannot be opened. Reported by David (CP-PR1) via WhatsApp", "URGENT"],
    ["[Mold] Mold spreading in IH-PR2 unit — reported by Edward (IH captain) via WhatsApp 15 Jun", "HIGH"],
    ["[IH-STD3] The aircon is dripping. It drips straight into the door handle and soaks the door", "HIGH"],
    ["[Balcony] Buzzing sound, suspected loose connection / fixture — needs investigation.", "ROUTINE"],
    ["[TG-PR3] Wardrobe issue — needs hinge / rail re-fix.", "ROUTINE"],
  ];
  for (const [text, want] of real) {
    assert.equal(suggestSeverity(text), want, `wrong severity for: ${text.slice(0, 50)}`);
  }
});

test("the same danger scores the same however it is worded", () => {
  // The asymmetry that justifies this: an over-rated light bulb costs an
  // afternoon, an under-rated burned socket is a fire in a building people
  // sleep in. So wording must not decide safety.
  for (const t of ["there is a fire", "socket burned", "the plug is burnt",
                   "smells of burning", "wire melted", "sparks from the switch",
                   "i got a shock from the tap", "exposed wires in the corridor",
                   "this is a safety hazard", "the balcony rail is unsafe"]) {
    assert.equal(suggestSeverity(t), "URGENT", `should be urgent: ${t}`);
  }
  // Locked in or out, in either word order.
  for (const t of ["door won't open", "the door cannot be opened",
                   "front door handle removed, door cannot be opened",
                   "unable to lock the front door", "can't close the gate",
                   "i am locked out", "the lock is broken"]) {
    assert.equal(suggestSeverity(t), "URGENT", `should be urgent: ${t}`);
  }
});

test("severity does not inflate the ordinary", () => {
  assert.equal(suggestSeverity("light bulb in the corridor needs replacing"), "ROUTINE");
  assert.equal(suggestSeverity("wardrobe hinge needs a re-fix"), "ROUTINE");
  assert.equal(suggestSeverity("scuff on the bedroom wall"), "COSMETIC");
  assert.equal(suggestSeverity("paint is chipped"), "COSMETIC");
  assert.equal(suggestSeverity(""), "ROUTINE");
  assert.equal(suggestSeverity(null), "ROUTINE");
  // A cosmetic word next to a real fault is not cosmetic.
  assert.equal(suggestSeverity("stain on the ceiling from a leak"), "HIGH");
  assert.equal(suggestSeverity("scratched the door and now it cannot lock"), "URGENT");
});

test("suggestCategory routes to the live enum", () => {
  assert.equal(suggestCategory("aircon is dripping"), "AC");
  assert.equal(suggestCategory("toilet won't flush"), "PLUMBING");
  assert.equal(suggestCategory("the light bulb blew"), "ELECTRICAL");
  assert.equal(suggestCategory("my wardrobe door fell off"), "FURNITURE");
  assert.equal(suggestCategory("there are cockroaches"), "CLEANING");
  assert.equal(suggestCategory("something odd"), "OTHER");
});

test("a ticket must say what, where and who", () => {
  const good = { description: "toilet blocked", listing_code: "CP-MR", reporter_phone: "+6591234567" };
  assert.equal(validateTicket(good).ok, true);

  const noWhere = validateTicket({ description: "x", reporter_phone: "+65912" });
  assert.ok(noWhere.missing.includes("one of: listing_code, property_slug"));

  // The exact gap this table had: a report with no portal account behind it.
  // It must now pass on a phone alone.
  const phoneOnly = validateTicket({ description: "x", property_slug: "chiltern-park", reporter_phone: "+6591234567" });
  assert.equal(phoneOnly.ok, true);
  const anonymous = validateTicket({ description: "x", property_slug: "chiltern-park" });
  assert.ok(anonymous.missing.includes("one of: reporter_phone, submitted_by"));

  assert.equal(validateTicket({ ...good, severity: "SPICY" }).ok, false);
  assert.equal(validateTicket({ ...good, category: "VIBES" }).ok, false);
  assert.equal(validateTicket({ ...good, severity: "urgent" }).ok, true, "case-insensitive");
});

test("ticketInsert fills severity from the text but an explicit value wins", () => {
  const guessed = ticketInsert(
    { description: "no water at all", reporter_phone: "+6591234567" },
    { roomId: "r1", propertyId: "p1", now: T0 });
  assert.equal(guessed.severity, "URGENT");
  assert.equal(guessed.category, "PLUMBING");
  assert.equal(guessed.due_at, plusHours(4));
  assert.equal(guessed.status, "OPEN");

  // The person in the flat outranks the keyword list.
  const told = ticketInsert(
    { description: "no water at all", severity: "ROUTINE", category: "OTHER", reporter_phone: "+65912" },
    { now: T0 });
  assert.equal(told.severity, "ROUTINE");
  assert.equal(told.category, "OTHER");
  assert.equal(told.due_at, plusHours(24 * 7));
});

test("ticketView carries the chase counters the chaser decides on", () => {
  // Regression found by running the chaser against production: these were
  // missing from the view, so every overdue ticket read as chase_count 0
  // and an ignored fault would have been nudged forever instead of raised.
  const fresh = ticketView({ id: "1", description: "d" }, null);
  assert.equal(fresh.chase_count, 0, "a fresh ticket has been chased zero times, not null");
  assert.equal(fresh.last_chased_at, null);

  const chased = ticketView({
    id: "1", status: "OPEN", due_at: "2026-08-01T00:00:00Z",
    chase_count: MAX_CHASES, last_chased_at: "2026-08-11T00:00:00Z",
  }, null);
  assert.equal(chased.chase_count, MAX_CHASES);
  assert.equal(chased.last_chased_at, "2026-08-11T00:00:00Z");
  // The point of exposing them: a caller holding only the view can reach
  // the same verdict as a caller holding the row.
  assert.equal(shouldEscalate(chased, new Date("2026-08-12T00:00:00Z")), true);
});

test("ticketView never leaks the reporter or internal ids", () => {
  const view = ticketView({
    id: "t1", category: "AC", severity: "HIGH", status: "OPEN",
    description: "aircon", due_at: T0, created_at: T0,
    reporter_phone: "+6591234567", channel_id: "secret", idempotency_key: "k",
    submitted_by: "user-uuid", charge_amount: 250,
  }, "CP-MR");
  assert.equal(view.listing_code, "CP-MR");
  assert.ok(!("reporter_phone" in view), "a reporter's number must not travel back");
  assert.ok(!("channel_id" in view));
  assert.ok(!("idempotency_key" in view));
  assert.ok(!("submitted_by" in view));
  assert.ok(!("charge_amount" in view));
});

test("the chaser nudges overdue work without harassing anyone", () => {
  const overdue = { status: "OPEN", due_at: plusHours(-1), chase_count: 0 };
  assert.equal(shouldChase(overdue, T0), true);

  // Not yet due: silence is correct.
  assert.equal(shouldChase({ status: "OPEN", due_at: plusHours(5), chase_count: 0 }, T0), false);
  // Resolved work is never chased.
  assert.equal(shouldChase({ status: "RESOLVED", due_at: plusHours(-99), chase_count: 0 }, T0), false);
  // Already nudged an hour ago: wait for the daily interval.
  assert.equal(shouldChase({ ...overdue, last_chased_at: plusHours(-1) }, T0), false);
  // A day later it may nudge again.
  assert.equal(shouldChase({ ...overdue, last_chased_at: plusHours(-25) }, T0), true);
  // Three strikes and it stops nagging.
  assert.equal(shouldChase({ ...overdue, chase_count: MAX_CHASES }, T0), false);
  // A ticket with no deadline cannot be judged late.
  assert.equal(shouldChase({ status: "OPEN", due_at: null }, T0), false);
});

test("what stops being chased starts being escalated, never dropped", () => {
  const exhausted = { status: "OPEN", due_at: plusHours(-50), chase_count: MAX_CHASES };
  assert.equal(shouldChase(exhausted, T0), false);
  assert.equal(shouldEscalate(exhausted, T0), true, "silence is the failure mode");

  assert.equal(shouldEscalate({ status: "OPEN", due_at: plusHours(-1), chase_count: 0 }, T0), false);
  assert.equal(shouldEscalate({ status: "ESCALATED", due_at: plusHours(-50), chase_count: 9 }, T0), false);
  assert.equal(shouldEscalate({ status: "RESOLVED", due_at: plusHours(-50), chase_count: 9 }, T0), false);
});

test("a ticket cannot go quiet without saying what happened", () => {
  // Closing is the moment the system stops looking, which is exactly when
  // to insist on evidence. Anything short of RESOLVED is untouched: this
  // must not get in the way of triaging or scheduling.
  assert.equal(validateClose({ status: "ACKNOWLEDGED" }).ok, true);
  assert.equal(validateClose({ severity: "URGENT" }).ok, true);
  assert.equal(validateClose({}).ok, true);

  const bare = validateClose({ status: "RESOLVED" });
  assert.equal(bare.ok, false);
  assert.ok(bare.missing.some((m) => m.startsWith("resolution_note is required")));
  assert.ok(bare.missing.some((m) => m.startsWith("resolved_by is required")));

  // 23 of the 26 resolved tickets in production have no resolved_by, which
  // is how "it was fixed, we think, by someone" became the record.
  assert.equal(validateClose({ status: "RESOLVED", resolution_note: "Replaced the socket outlet" }).ok,
    false, "a note without an owner is still anonymous");
  assert.equal(validateClose(
    { status: "RESOLVED", resolution_note: "Replaced the socket outlet" },
    { actor: "reply-brain" }).ok, true, "the calling key can stand as the owner");
  assert.equal(validateClose(
    { status: "RESOLVED", resolution_note: "Replaced the socket outlet", resolved_by: "Kavi" }).ok, true);

  // An empty gesture is not a record.
  assert.equal(validateClose({ status: "RESOLVED", resolution_note: "   ", resolved_by: "Kavi" }).ok, false);
  assert.equal(validateClose({ status: "RESOLVED", resolution_note: "ok", resolved_by: "Kavi" }).ok, false);
  assert.equal(validateClose({ status: "resolved", resolution_note: "Done, new bulb fitted", resolved_by: "Kavi" }).ok,
    true, "the check is case insensitive, like the rest of the status handling");
});
