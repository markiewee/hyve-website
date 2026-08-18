// Run with: node --test supabase/functions/_shared/viewingEmails.test.js
//
// The viewing emails drifted a full design generation behind the tenant emails
// because they carried their own private shell and nothing could see it. These
// assert the things that fail silently: a template falling back off the design
// system, an internal sentinel leaking into copy a prospect reads, and the
// confirmation promising a send that does not exist.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tplConfirmation,
  tplCaptainNotify,
  tplAdminNotify,
  tplReminder24h,
  tplCancelled,
  tplRescheduled,
  tplOffHorizonReminder,
  fmtDateTime,
  mapsUrl,
} from "./viewingEmails.js";

/** Decode an attachment the way the edge runtime encodes it. Deliberately
    not Buffer: this file has to run under the same web globals the function
    ships to. */
const unb64 = (s) =>
  new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

const viewing = {
  id: "8be235ce-e86c-4494-ba34-918083c2c3a9",
  prospect_name: "Mark",
  prospect_email: "markwee99@gmail.com",
  prospect_phone: "+6581333757",
  source: "direct",
  slot_start: "2026-08-22T05:15:00+00:00",
  slot_end: "2026-08-22T05:45:00+00:00",
  properties: {
    name: "Ivory Heights 122",
    code: "IH",
    address: "#08-33, Blk 122 Jurong East St 13, Singapore 600122",
    default_access_code: "808855",
    default_security_instructions:
      "Block 122 Jurong East St 13. Tell the guard you are visiting Hyve.",
  },
  rooms: { name: "IH Standard Room 1", unit_code: "IH-SR1" },
};
const captain = { name: "Edward Jeremy Lo", phone: "+65 83654765" };
const cancelUrl = "https://www.lazybee.sg/leads/close?t=abc";
const lead = {
  name: "Mark",
  property_interest: ["Ivory Heights 122"],
  intent: { target_move_in_date: "October 2026" },
};

const ALL = () => [
  tplConfirmation({ viewing, captain, cancelUrl }),
  tplCaptainNotify({ viewing, captainName: captain.name }),
  tplAdminNotify({ viewing }),
  tplReminder24h({ viewing, captain, cancelUrl }),
  tplCancelled({ viewing, recipientType: "prospect", cancelUrl }),
  tplCancelled({ viewing, recipientType: "captain", cancelUrl }),
  tplCancelled({ viewing, recipientType: "admin", cancelUrl }),
  tplRescheduled({ viewing, captain, cancelUrl, previousStart: '2026-08-15T05:15:00+00:00' }),
  tplRescheduled({ viewing, captain, cancelUrl, previousStart: '2026-08-15T05:15:00+00:00', recipientType: 'captain' }),
  tplOffHorizonReminder(lead),
];

test("no viewing email carries the pre-redesign teal shell", () => {
  for (const email of ALL()) {
    assert.ok(!email.html.includes("#006b5f"), `${email.subject} still uses the old teal`);
    assert.ok(!email.html.includes("#f8f9ff"), `${email.subject} still uses the old panel`);
  }
});

test("every viewing email renders through the design system", () => {
  for (const email of ALL()) {
    assert.ok(email.html.includes("#B08D4F"), `${email.subject} is missing the brass accent`);
    assert.ok(email.html.includes("Cormorant Garamond"), `${email.subject} is missing the headline face`);
    assert.ok(email.html.includes("JetBrains Mono"), `${email.subject} is missing the mono face`);
    assert.ok(email.html.includes("#F6F2EA"), `${email.subject} is missing the alabaster ground`);
  }
});

test("no email written to a human contains a dash Mark would object to", () => {
  for (const email of ALL()) {
    assert.ok(!email.subject.includes("—"), `${email.subject} has an em-dash in the subject`);
    assert.ok(!email.subject.includes("–"), `${email.subject} has an en-dash in the subject`);
  }
});

test("the confirmation no longer promises a 2h reminder we never send", () => {
  const { html } = tplConfirmation({ viewing, captain, cancelUrl });
  assert.ok(!html.includes("2 hours"), "confirmation still promises a 2h reminder");
  assert.ok(html.includes("the day before"), "confirmation should promise the day-before mail");
});

test("the day-before email carries the door code and the way in", () => {
  const { html } = tplReminder24h({ viewing, captain, cancelUrl });
  assert.ok(html.includes("808855"), "missing the door code");
  assert.ok(html.includes("Tell the guard"), "missing the security instructions");
  assert.ok(html.includes("Edward Jeremy Lo"), "missing the captain");
});

test("a viewing with no captain never prints the placeholder at a reader", () => {
  const noCaptain = { name: "House Captain", phone: null };
  const conf = tplConfirmation({ viewing, captain: noCaptain, cancelUrl });
  assert.ok(!conf.html.includes("House Captain"), "placeholder leaked into the confirmation");
  const rem = tplReminder24h({ viewing, captain: noCaptain, cancelUrl });
  assert.ok(!rem.html.includes("House Captain"), "placeholder leaked into the reminder");
  assert.ok(
    rem.html.includes("the code above is enough"),
    "a captainless viewing should still tell the prospect how to get in"
  );
});

test("a property with no door code on file does not print an empty row", () => {
  const bare = { ...viewing, properties: { ...viewing.properties, default_access_code: null } };
  const { html } = tplReminder24h({ viewing: bare, captain, cancelUrl });
  assert.ok(html.includes("WhatsApp us when you arrive"), "should fall back to a human, not a blank");
});

test("prospect emails point at the address on a map", () => {
  const conf = tplConfirmation({ viewing, captain, cancelUrl });
  const rem = tplReminder24h({ viewing, captain, cancelUrl });
  assert.ok(conf.html.includes("google.com/maps"), "confirmation has no directions link");
  assert.ok(rem.html.includes("google.com/maps"), "day-before mail has no directions link");
});

test("the confirmation still attaches a calendar invite", () => {
  const { attachments } = tplConfirmation({ viewing, captain, cancelUrl });
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].filename, "viewing.ics");
  const ics = unb64(attachments[0].content);
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("STATUS:CONFIRMED"));
});

test("a cancelled viewing sends the prospect a CANCEL invite so it leaves their calendar", () => {
  const { attachments } = tplCancelled({ viewing, recipientType: "prospect", cancelUrl });
  const ics = unb64(attachments[0].content);
  assert.ok(ics.includes("STATUS:CANCELLED"));
  assert.ok(ics.includes("METHOD:CANCEL"));
  assert.equal(tplCancelled({ viewing, recipientType: "admin", cancelUrl }).attachments, undefined);
});

test("times read in Singapore time, where the reader is standing", () => {
  const s = fmtDateTime("2026-08-22T05:15:00+00:00");
  assert.ok(s.includes("Saturday"), s);
  assert.ok(s.includes("22 August 2026"), s);
  assert.ok(s.includes("1:15"), s);
});

test("a missing contact detail reads as words, not a stray symbol", () => {
  const bare = { ...viewing, prospect_email: null, prospect_phone: null, source: null };
  const { html } = tplAdminNotify({ viewing: bare });
  assert.ok(html.includes("No email"), "should say what is missing");
  assert.ok(!html.includes("&mdash;"), "should not fall back to a bare dash");
});

test("mapsUrl escapes an address with a unit number in it", () => {
  assert.ok(mapsUrl("#08-33, Blk 122").includes("%2308-33"));
});

test("the calendar invite survives a comma in the address and an accent in a name", () => {
  const finn = { ...viewing, prospect_name: "Julia Rönkkö" };
  const { attachments } = tplConfirmation({ viewing: finn, captain, cancelUrl });
  const ics = unb64(attachments[0].content);
  // Commas separate fields in RFC5545, so an unescaped one truncates LOCATION
  // and the invite drops the prospect at the wrong block.
  assert.ok(ics.includes("LOCATION:#08-33\\, Blk 122"), ics.split("\r\n").find((l) => l.startsWith("LOCATION")));
  assert.ok(ics.includes("Singapore 600122"), "address was truncated");
});

/* ── moved viewings ───────────────────────────────────────────────── */

const PREV = "2026-08-15T05:15:00+00:00";

test("a moved viewing says what it moved from, not just to", () => {
  // "Your viewing is confirmed" with no reference to the old time reads like a
  // second booking, and the prospect turns up twice or not at all.
  const { html, subject } = tplRescheduled({ viewing, captain, cancelUrl, previousStart: PREV });
  assert.ok(html.includes("22 August 2026"), "missing the new time");
  assert.ok(html.includes("15 August 2026"), "missing the old time");
  assert.ok(html.includes("<s>"), "the old time should read as struck through");
  assert.ok(subject.toLowerCase().startsWith("moved"), subject);
});

test("the prospect gets a fresh invite so their calendar follows", () => {
  const { attachments } = tplRescheduled({ viewing, captain, cancelUrl, previousStart: PREV });
  assert.equal(attachments.length, 1);
  const ics = unb64(attachments[0].content);
  assert.ok(ics.includes("STATUS:CONFIRMED"));
  // Same UID as the original, which is what makes a calendar move the existing
  // entry rather than add a second one next to it.
  assert.ok(ics.includes(`UID:${viewing.id}@lazybee.sg`));
});

test("the captain is told, because turning up on the old Saturday is the whole risk", () => {
  const cap = tplRescheduled({ viewing, captain, cancelUrl, previousStart: PREV, recipientType: "captain" });
  assert.ok(cap.html.includes("22 August 2026"));
  assert.ok(cap.html.includes("Nothing else for you to do"));
  assert.equal(cap.attachments, undefined, "only the prospect needs the invite");
});

test("admin sees the contact details the captain does not need", () => {
  const admin = tplRescheduled({ viewing, captain, cancelUrl, previousStart: PREV, recipientType: "admin" });
  assert.ok(admin.html.includes("markwee99@gmail.com"));
  const cap = tplRescheduled({ viewing, captain, cancelUrl, previousStart: PREV, recipientType: "captain" });
  assert.ok(!cap.html.includes("markwee99@gmail.com"));
});

test("a move with no previous time on file still renders", () => {
  const { html } = tplRescheduled({ viewing, captain, cancelUrl, previousStart: null });
  assert.ok(html.includes("22 August 2026"));
  assert.ok(!html.includes("<s>"), "no struck-through row when there is nothing to strike");
});
