// src/lib/partnerBookings.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { validateBooking, bookingView } from "./partnerBookings.js";

test("validateBooking requires listing_code, starts_on and guest.name", () => {
  assert.deepEqual(validateBooking({}), { ok: false, missing: ["listing_code", "starts_on", "guest.name"] });
  assert.deepEqual(
    validateBooking({ listing_code: "IH-STD1", starts_on: "2026-10-01", guest: { name: "Jane" } }),
    { ok: true, missing: [] }
  );
});

test("validateBooking accepts null ends_on but refuses ends_on before starts_on", () => {
  const base = { listing_code: "IH-STD1", starts_on: "2026-10-01", guest: { name: "Jane" } };
  assert.equal(validateBooking({ ...base, ends_on: null }).ok, true);
  assert.equal(validateBooking({ ...base, ends_on: "2027-01-01" }).ok, true);
  const bad = validateBooking({ ...base, ends_on: "2026-09-01" });
  assert.equal(bad.ok, false);
  assert.ok(bad.missing.includes("ends_on >= starts_on"));
});

test("bookingView exposes ONLY the documented keys", () => {
  const view = bookingView({
    id: "b1", starts_on: "2026-10-01", ends_on: null, status: "confirmed",
    external_ref: "OTA-1", created_at: "t", guest: { name: "Jane", email: "j@x.com" },
    channel_id: "secret", room_id: "secret", idempotency_key: "k",
  }, "IH-STD1");
  assert.deepEqual(Object.keys(view).sort(),
    ["created_at", "ends_on", "external_ref", "id", "listing_code", "starts_on", "status"].sort());
  assert.equal(view.listing_code, "IH-STD1");
});
