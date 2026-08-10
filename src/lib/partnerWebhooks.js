// src/lib/partnerWebhooks.js
//
// Webhook event naming and signing. The signature format is the widely
// understood t=<unix>,v1=<hmac> scheme so partners can verify with ten lines
// of code, documented on /developers.

import { createHmac, timingSafeEqual } from "node:crypto";

export const EVENT_TYPES = new Set([
  "listing.calendar.updated",
  "listing.rates.updated",
  "listing.profile.updated",
  "booking_request.updated",
  "booking.updated",
]);

const TABLE_EVENTS = {
  room_calendar: "listing.calendar.updated",
  listing_channels: "listing.rates.updated",
  rooms: "listing.rates.updated",
  listing_profiles: "listing.profile.updated",
  booking_requests: "booking_request.updated",
  channel_bookings: "booking.updated",
};

export function eventForChange(table) {
  return TABLE_EVENTS[table] ?? null;
}

export function signPayload(secret, body, timestampSec) {
  const t = timestampSec ?? Math.floor(Date.now() / 1000);
  const mac = createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},v1=${mac}`;
}

export function verifySignature(secret, body, header) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!m) return false;
  const expected = createHmac("sha256", secret).update(`${m[1]}.${body}`, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(m[2], "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
