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
  tplOffHorizonReminder,
  fmtDateTime,
  mapsUrl,
} from "./viewingEmails.js";

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
  const ics = Buffer.from(attachments[0].content, "base64").toString("utf8");
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("STATUS:CONFIRMED"));
});

test("a cancelled viewing sends the prospect a CANCEL invite so it leaves their calendar", () => {
  const { attachments } = tplCancelled({ viewing, recipientType: "prospect", cancelUrl });
  const ics = Buffer.from(attachments[0].content, "base64").toString("utf8");
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
