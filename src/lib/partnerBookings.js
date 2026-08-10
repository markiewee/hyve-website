// src/lib/partnerBookings.js
//
// Confirmed bookings, the v1.1 addition. Same philosophy as the other
// partner modules: validation and output shapes are pure and tested, and the
// bookingView key set is asserted so guest details, channel ids and
// idempotency keys can never leak into a response by accident. Overlap
// checking is deliberately absent everywhere: Mark overbooks on purpose.

export function validateBooking(body) {
  const b = body ?? {};
  const missing = [];
  if (!b.listing_code) missing.push("listing_code");
  if (!b.starts_on) missing.push("starts_on");
  if (!b.guest?.name) missing.push("guest.name");
  if (b.ends_on != null && b.starts_on && b.ends_on < b.starts_on) missing.push("ends_on >= starts_on");
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
