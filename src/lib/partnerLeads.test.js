// src/lib/partnerLeads.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalisePhone, validateLead, validateActivation, leadPatch,
  mergeIdentifiers, leadView, leadUpdatePatch, validateLeadUpdate,
} from "./partnerLeads.js";

test("normalisePhone keeps real numbers and refuses WhatsApp LIDs", () => {
  // Singapore local, the common case off the Hyve line.
  assert.equal(normalisePhone("91234567"), "+6591234567");
  assert.equal(normalisePhone("8069 5410"), "+6580695410");
  assert.equal(normalisePhone("6591234567"), "+6591234567");
  assert.equal(normalisePhone("+65 9123 4567"), "+6591234567");
  // Already international, left alone.
  assert.equal(normalisePhone("+358443038745"), "+358443038745");
  assert.equal(normalisePhone("+60123456789"), "+60123456789");
  assert.equal(normalisePhone("60123456789"), "+60123456789");

  // These are the dangerous ones. All are real values sitting in the
  // production leads table and none of them is a phone number: they are
  // WhatsApp LID privacy identifiers. Treating one as a key would merge
  // strangers into a single person.
  for (const lid of ["90070873755", "305823417484", "290516817208",
                     "093479303193", "3776541599", "7801756371"]) {
    assert.equal(normalisePhone(lid), null, `${lid} must not be read as a phone`);
  }
  // Eight digits but not a Singapore mobile prefix.
  assert.equal(normalisePhone("40424683"), null);
  assert.equal(normalisePhone("251746049"), null);
  assert.equal(normalisePhone(""), null);
  assert.equal(normalisePhone(null), null);
  assert.equal(normalisePhone("not a phone"), null);
});

test("a lead needs a name and at least one way to reach them again", () => {
  assert.equal(validateLead({ name: "Jane", phone: "91234567" }).ok, true);
  assert.equal(validateLead({ name: "Jane", chat_id: "358" }).ok, true);
  assert.equal(validateLead({ name: "Jane", email: "j@example.com" }).ok, true);
  // A LID is not a phone, but it IS a handle, so it still counts.
  assert.equal(validateLead({ name: "Jane", identifiers: ["90070873755"] }).ok, true);

  const nameless = validateLead({ phone: "91234567" });
  assert.equal(nameless.ok, false);
  assert.ok(nameless.missing.includes("name"));

  const unreachable = validateLead({ name: "Jane" });
  assert.equal(unreachable.ok, false);
  assert.ok(unreachable.missing.some((m) => m.startsWith("one of:")));

  // Caught in production verification: a platform thread often yields only
  // a LID, a worker naturally puts it in `phone`, and rejecting that would
  // drop exactly the leads the platform bots exist to catch. It is a handle,
  // so it is accepted; leadPatch still refuses to let it become the key.
  const lidOnly = validateLead({ name: "Jane", phone: "90070873755" });
  assert.equal(lidOnly.ok, true);
  assert.ok(!("phone_e164" in leadPatch({ name: "Jane", phone: "90070873755" })));

  // Whitespace is not a handle.
  assert.equal(validateLead({ name: "Jane", phone: "   " }).ok, false);
});

test("validateLead rejects bad enums and dates with named reasons", () => {
  const bad = validateLead({ name: "J", phone: "91234567", status: "wandering" });
  assert.equal(bad.ok, false);
  assert.ok(bad.missing.some((m) => m.startsWith("status must be one of")));

  const slash = validateLead({ name: "J", phone: "91234567", move_in: "01/06/2027" });
  assert.equal(slash.ok, false);
  assert.ok(slash.missing.includes("move_in must be an ISO date (YYYY-MM-DD)"));

  assert.equal(validateLead({ name: "J", phone: "91234567", occupants: 2 }).ok, true);
  assert.equal(validateLead({ name: "J", phone: "91234567", occupants: 0 }).ok, false);
  assert.equal(validateLead({ name: "J", phone: "91234567", occupants: 1.5 }).ok, false);
  assert.equal(validateLead({ name: "J", phone: "91234567", role: "landlord" }).ok, false);
  assert.equal(validateLead({ name: "J", phone: "91234567", role: "AGENT" }).ok, true);
});

test("a STORED lead must carry a condition something can evaluate", () => {
  const vague = validateLead({ name: "J", phone: "91234567", lifecycle: "STORED" });
  assert.equal(vague.ok, false);
  assert.ok(vague.missing.includes("a STORED lead needs an activation_condition"));

  const dated = validateLead({
    name: "J", phone: "91234567", lifecycle: "STORED",
    activation_condition: { type: "DATE", on: "2026-11-01" },
  });
  assert.equal(dated.ok, true);

  assert.equal(validateActivation({ type: "DATE", on: "next November" }).ok, false);
  assert.equal(validateActivation({ type: "ROOM", listing_code: "CP-MR" }).ok, true);
  assert.equal(validateActivation({ type: "ROOM" }).ok, false);
  assert.equal(validateActivation({ type: "BUDGET", max_monthly: 1400 }).ok, true);
  assert.equal(validateActivation({ type: "BUDGET", max_monthly: 0 }).ok, false);
  assert.equal(validateActivation({ type: "SOMEDAY" }).ok, false);
  assert.equal(validateActivation(null).ok, true);
});

test("leadPatch omits what the caller did not mention", () => {
  // The brain learns one thing per thread. A patch that sent nulls for
  // everything else would blank a budget somebody captured last week.
  const patch = leadPatch({ name: "Jane", phone: "91234567", budget_monthly: 1200 });
  assert.equal(patch.name, "Jane");
  assert.equal(patch.phone_e164, "+6591234567");
  assert.equal(patch.budget_monthly, 1200);
  assert.ok(!("move_in" in patch), "absent fields must not appear in the patch");
  assert.ok(!("occupants" in patch));
  assert.ok(patch.updated_at);

  // A LID in the phone field must not become a fake key.
  const lid = leadPatch({ name: "Jane", phone: "90070873755" });
  assert.ok(!("phone_e164" in lid), "a LID must never populate the key column");
  assert.equal(lid.phone, "90070873755", "but the raw handle is still kept");

  const codes = leadPatch({ name: "J", phone: "91234567", matched_room_codes: ["cp-mr", " ih-std1 "] });
  assert.deepEqual(codes.matched_room_codes, ["CP-MR", "IH-STD1"]);
});

test("identifiers accumulate instead of replacing", () => {
  assert.deepEqual(mergeIdentifiers(["carousell:jane"], ["90070873755"]),
    ["carousell:jane", "90070873755"]);
  assert.deepEqual(mergeIdentifiers(["a"], ["a", "b", "a"]), ["a", "b"]);
  assert.deepEqual(mergeIdentifiers(null, null), []);
  assert.deepEqual(mergeIdentifiers(["a"], [" ", ""]), ["a"]);
});

test("leadView exposes an exact key set and prefers the normalised phone", () => {
  const view = leadView({
    id: "1", name: "Jane", phone: "91234567", phone_e164: "+6591234567",
    status: "new", lifecycle: "ACTIVE", role: "prospect",
    notes: "INTERNAL: haggled hard", channel_id: "secret-channel",
    idempotency_key: "abc", activity_log: [{ secret: true }],
  });
  assert.equal(view.phone, "+6591234567");
  assert.deepEqual(Object.keys(view).sort(), [
    "activation_condition", "budget_monthly", "created_at", "email", "id",
    "lifecycle", "matched_room_codes", "move_in", "name", "next_action",
    "occupants", "phone", "property_interest", "role", "status", "updated_at",
  ]);
  // The things that must never travel back to a caller.
  assert.ok(!("notes" in view));
  assert.ok(!("channel_id" in view));
  assert.ok(!("idempotency_key" in view));
  assert.ok(!("activity_log" in view));
});

test("leadUpdatePatch cannot change who somebody is", () => {
  // The whole safety property of the id route. A caller that sends a phone
  // is either confused or malicious; either way the identity columns are
  // absent from the patch by construction, so the row keeps its identity.
  const patch = leadUpdatePatch({
    lifecycle: "ACTIVE", next_action: "reactivated: date arrived",
    phone: "91234567", email: "someone@else.com", chat_id: "999",
    identifiers: ["carousell:someone-else"],
  });
  assert.equal(patch.lifecycle, "ACTIVE");
  assert.equal(patch.next_action, "reactivated: date arrived");
  for (const k of ["phone", "phone_e164", "email", "chat_id", "identifiers"]) {
    assert.ok(!(k in patch), `${k} must never appear in an id-addressed update`);
  }
  assert.ok(patch.updated_at);
});

test("leadUpdatePatch leaves out what the caller did not mention", () => {
  const patch = leadUpdatePatch({ status: "viewing_booked" });
  assert.deepEqual(Object.keys(patch).sort(), ["status", "updated_at"]);
  // Null is a real value here: it is how you clear a field on purpose.
  assert.ok("next_action" in leadUpdatePatch({ next_action: null }));

  const codes = leadUpdatePatch({ matched_room_codes: ["cp-mr", " ih-std1 "] });
  assert.deepEqual(codes.matched_room_codes, ["CP-MR", "IH-STD1"]);
});

test("validateLeadUpdate keeps the enum and date rules, drops the reachability one", () => {
  // An existing row is already reachable, so an update need not prove it.
  assert.equal(validateLeadUpdate({ lifecycle: "ACTIVE" }).ok, true);
  assert.equal(validateLeadUpdate({ next_action: "chase them" }).ok, true);

  const bad = validateLeadUpdate({ status: "wandering" });
  assert.equal(bad.ok, false);
  assert.ok(bad.missing.some((m) => m.startsWith("status must be one of")));
  assert.equal(validateLeadUpdate({ move_in: "01/06/2027" }).ok, false);
  assert.equal(validateLeadUpdate({ occupants: 0 }).ok, false);
  assert.equal(validateLeadUpdate({ lifecycle: "SOMEDAY" }).ok, false);

  // Putting a lead back to sleep still needs a condition something can
  // evaluate, or "follow up later" becomes a lie again.
  const restored = validateLeadUpdate({ lifecycle: "STORED", activation_condition: null });
  assert.equal(restored.ok, false);
  assert.equal(restored.missing.length, 1, "the reason should be given once, not twice");
  assert.equal(validateLeadUpdate({
    lifecycle: "STORED", activation_condition: { type: "DATE", on: "2027-01-01" },
  }).ok, true);
  assert.equal(validateLeadUpdate({
    lifecycle: "STORED", activation_condition: { type: "DATE", on: "someday" },
  }).ok, false);
});

test("parking a lead cold requires a follow-up date", () => {
  // 16 leads sit at status cold with no date attached, which is the
  // "waiting on them, forever" state the loops board bans. Cold is fine;
  // cold with no wake-up date is a person silently dropped.
  const base = { name: "x", phone: "91234567" };
  const parked = validateLead({ ...base, status: "cold" });
  assert.equal(parked.ok, false);
  assert.ok(parked.missing.some((m) => m.includes("next_action_due")));

  assert.equal(validateLead({ ...base, status: "cold", next_action_due: "2026-09-01" }).ok, true);
  // Non-cold statuses stay unaffected.
  assert.equal(validateLead({ ...base, status: "qualified" }).ok, true);
});
