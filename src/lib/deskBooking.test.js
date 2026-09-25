// src/lib/deskBooking.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { validateDeskBooking, tenancyEnd, deskStage } from "./deskBooking.js";

const today = new Date("2026-09-25T00:00:00+08:00");
const good = {
  pin: "900712", room_id: "3b2c1d4e-0000-4000-8000-000000000001",
  move_in: "2026-12-07", months: 6,
  student: { name: " Wei Ling ", email: "WL@Example.com ", phone: "+65 9123 4567", nationality: "Malaysia" },
};

test("accepts a complete booking and normalises it", () => {
  const r = validateDeskBooking(good, today);
  assert.equal(r.ok, true);
  assert.equal(r.value.student.name, "Wei Ling");
  assert.equal(r.value.student.email, "wl@example.com");
  assert.equal(r.value.months, 6);
});

test("rejects a bad pin, missing name, bad email, bad date", () => {
  const r = validateDeskBooking({ ...good, pin: "12", student: { name: "", email: "nope" }, move_in: "07/12/2026" }, today);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.sort(), ["email", "move_in", "name", "pin"]);
});

test("rejects a move-in in the past and months outside 3 to 36", () => {
  assert.deepEqual(validateDeskBooking({ ...good, move_in: "2026-09-01" }, today).errors, ["move_in"]);
  assert.deepEqual(validateDeskBooking({ ...good, months: 2 }, today).errors, ["months"]);
  assert.deepEqual(validateDeskBooking({ ...good, months: 37 }, today).errors, ["months"]);
});

test("tenancy ends the day before the same date N months on", () => {
  assert.equal(tenancyEnd("2026-09-26", 12), "2027-09-25");
  assert.equal(tenancyEnd("2026-12-07", 6), "2027-06-06");
  assert.equal(tenancyEnd("2027-01-31", 1), "2027-02-27");
});

test("stage is the furthest step reached", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  assert.equal(deskStage({ cancelled: true }, now), "cancelled");
  assert.equal(deskStage({ deposit_at: "x", signed_up: true }, now), "deposit");
  assert.equal(deskStage({ ta_signed_at: "x", signed_up: true }, now), "agreement");
  assert.equal(deskStage({ id_at: "x", signed_up: true }, now), "id");
  assert.equal(deskStage({ details_at: "x", signed_up: true }, now), "details");
  assert.equal(deskStage({ signed_up: true }, now), "signedUp");
  assert.equal(deskStage({ signed_up: false, invite_expires_at: "2026-09-30T00:00:00Z" }, now), "linkSent");
  assert.equal(deskStage({ signed_up: false, invite_expires_at: "2026-09-20T00:00:00Z" }, now), "expired");
});
