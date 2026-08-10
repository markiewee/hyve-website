// src/lib/partnerWebhooks.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_TYPES, signPayload, verifySignature, eventForChange } from "./partnerWebhooks.js";

test("event catalogue is exactly the documented five", () => {
  assert.deepEqual([...EVENT_TYPES].sort(), [
    "booking.updated",
    "booking_request.updated",
    "listing.calendar.updated",
    "listing.profile.updated",
    "listing.rates.updated",
  ]);
});

test("signature is HMAC-SHA256 over timestamp.body and round-trips", () => {
  const body = JSON.stringify({ a: 1 });
  const sig = signPayload("whsec_abc", body, 1723300000);
  assert.match(sig, /^t=1723300000,v1=[0-9a-f]{64}$/);
  assert.equal(verifySignature("whsec_abc", body, sig), true);
  assert.equal(verifySignature("whsec_abc", body + " ", sig), false);
  assert.equal(verifySignature("whsec_wrong", body, sig), false);
});

test("table changes map to event names", () => {
  assert.equal(eventForChange("room_calendar"), "listing.calendar.updated");
  assert.equal(eventForChange("listing_channels"), "listing.rates.updated");
  assert.equal(eventForChange("listing_profiles"), "listing.profile.updated");
  assert.equal(eventForChange("booking_requests"), "booking_request.updated");
  assert.equal(eventForChange("rooms"), "listing.rates.updated");
  assert.equal(eventForChange("channel_bookings"), "booking.updated");
  assert.equal(eventForChange("unrelated_table"), null);
});
