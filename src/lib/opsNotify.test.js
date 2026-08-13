import test from "node:test";
import assert from "node:assert/strict";
import {
  audienceFor, ticketCreatedMessage, digestMessage, KAVI_EVENTS,
} from "./opsNotify.js";

test("Mark's pocket holds urgent and money, nothing else", () => {
  // The whole point: Kavi runs the day to day, so the operational stream is
  // hers. Mark asked for exactly two things, and every other event that
  // reaches him is a regression of this rule.
  assert.deepEqual(audienceFor({ type: "ticket_created", severity: "URGENT" }), ["mark", "kavi"]);
  assert.deepEqual(audienceFor({ type: "ticket_created", severity: "HIGH" }), ["kavi"]);
  assert.deepEqual(audienceFor({ type: "ticket_created", severity: "ROUTINE" }), ["kavi"]);
  assert.deepEqual(audienceFor({ type: "viewing_booked" }), ["kavi"]);
  assert.deepEqual(audienceFor({ type: "photo_submitted" }), ["kavi"]);
});

test("money always reaches Mark, because only he may approve it", () => {
  // A quote is money about to be spent, so Kavi sanity-checks it and Mark
  // approves. A charge is money about to be asked of a tenant, and that is
  // Mark's alone.
  assert.deepEqual(audienceFor({ type: "quote_received" }), ["mark", "kavi"]);
  assert.deepEqual(audienceFor({ type: "charge_drafted" }), ["mark"]);
  assert.deepEqual(audienceFor({ type: "refund_requested" }), ["mark"]);
});

test("an unknown event notifies nobody rather than everybody", () => {
  // Silence is recoverable. A firehose into Mark's phone is the exact
  // failure this module exists to prevent, so a new event type is mute
  // until somebody deliberately adds it here.
  assert.deepEqual(audienceFor({ type: "something_new" }), []);
  assert.deepEqual(audienceFor({}), []);
  assert.deepEqual(audienceFor(null), []);
});

test("severity casing does not decide who gets woken", () => {
  assert.deepEqual(audienceFor({ type: "ticket_created", severity: "urgent" }), ["mark", "kavi"]);
});

test("a ticket message names the place, the severity and the deadline", () => {
  const m = ticketCreatedMessage({
    listing_code: "CP-PR2",
    severity: "HIGH",
    description: "cockroaches in the kitchen",
    due_at: "2026-08-15T10:00:00Z",
  });
  assert.match(m, /CP-PR2/);
  assert.match(m, /HIGH/);
  assert.match(m, /cockroaches/);
  assert.match(m, /2026-08-15/);
});

test("outbound copy carries no dashes and no emoji", () => {
  // Standing rule, and it is machine-checked here because a humanised
  // message that trips it gets noticed by Mark, not by us.
  const m = ticketCreatedMessage({
    listing_code: "IH-STD1", severity: "URGENT",
    description: "no hot water", due_at: "2026-08-13T10:00:00Z",
  });
  assert.equal(/[–—]/.test(m), false, "no en or em dashes");
  assert.equal(/\p{Extended_Pictographic}/u.test(m), false, "no emoji");
  const d = digestMessage({
    tickets: [{ severity: "URGENT", listing_code: "CP-PR2", days_open: 4 }],
    viewings: [], sellWindow: [],
  });
  assert.equal(/[–—]/.test(d), false);
  assert.equal(/\p{Extended_Pictographic}/u.test(d), false);
});

test("a ticket with nothing filled in still produces a sendable line", () => {
  const m = ticketCreatedMessage({});
  assert.match(m, /unknown unit/);
  assert.match(m, /no description/);
  assert.match(m, /no due date/);
});

test("a garbage due date reads as no due date, not as Invalid Date", () => {
  assert.match(ticketCreatedMessage({ due_at: "next tuesday" }), /no due date/);
});

test("an empty digest says so plainly instead of sending a blank", () => {
  assert.match(digestMessage({ tickets: [], viewings: [], sellWindow: [] }), /nothing open/i);
  assert.match(digestMessage(), /nothing open/i);
});

test("the digest counts by severity and surfaces the oldest", () => {
  const m = digestMessage({
    tickets: [
      { severity: "URGENT", listing_code: "CP-PR2", days_open: 4 },
      { severity: "HIGH", listing_code: "IH-STD3", days_open: 1 },
      { severity: "HIGH", listing_code: "TG-PR1", days_open: 1 },
    ],
    viewings: [{ listing_code: "IH-STD1" }],
    sellWindow: ["TG-PR2", "CP-MR"],
  });
  assert.match(m, /1 urgent/i);
  assert.match(m, /2 high/i);
  assert.match(m, /CP-PR2/, "the oldest ticket is named");
  assert.match(m, /4 days/);
  assert.match(m, /IH-STD1/, "today's viewings are named");
  assert.match(m, /TG-PR2/, "rooms to sell are named");
});

test("a young pile does not get an oldest callout", () => {
  const m = digestMessage({
    tickets: [{ severity: "ROUTINE", listing_code: "IH-STD3", days_open: 1 }],
    viewings: [], sellWindow: [],
  });
  assert.equal(/oldest/i.test(m), false);
  assert.match(m, /no viewings today/i);
});

test("the instant list is exactly the five agreed types", () => {
  // Widening this set is how Kavi's stream becomes noise she ignores, so
  // the count is pinned deliberately.
  assert.deepEqual([...KAVI_EVENTS].sort(), [
    "photo_submitted", "quote_received", "sla_warning", "ticket_created", "viewing_booked",
  ]);
});
