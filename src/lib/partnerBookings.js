// src/lib/partnerBookings.js
//
// Confirmed bookings, the v1.1 addition. Same philosophy as the other
// partner modules: validation and output shapes are pure and tested, and the
// bookingView key set is asserted so guest details, channel ids and
// idempotency keys can never leak into a response by accident. Overlap
// checking is deliberately absent everywhere: Mark overbooks on purpose.

// Strict ISO calendar date. The regexp alone is not enough: Date() will
// happily coerce "01/06/2027" (which Postgres then stored as January 6th,
// found live 11 Aug) and roll "2026-02-30" into March. The parse-and-format
// roundtrip rejects both: only a string that survives unchanged is a date.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(s) {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function validateBooking(body) {
  const b = body ?? {};
  const missing = [];
  if (!b.listing_code) missing.push("listing_code");
  if (!b.starts_on) missing.push("starts_on");
  else if (!isIsoDate(b.starts_on)) missing.push("starts_on must be an ISO date (YYYY-MM-DD)");
  if (!b.guest?.name) missing.push("guest.name");
  if (b.ends_on != null) {
    if (!isIsoDate(b.ends_on)) missing.push("ends_on must be an ISO date (YYYY-MM-DD)");
    else if (isIsoDate(b.starts_on) && b.ends_on < b.starts_on) missing.push("ends_on >= starts_on");
  }
  return { ok: missing.length === 0, missing };
}

export function bookingView(row, listingCode) {
  return {
    id: row.id,
    listing_code: listingCode,
    starts_on: row.starts_on,
    ends_on: row.ends_on ?? null,
    status: row.status,
    external_ref: row.external_ref ?? null,
    created_at: row.created_at,
  };
}
