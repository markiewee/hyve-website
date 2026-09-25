// src/lib/deskBooking.js
//
// The room desk booking form, checked the same way in the browser and on the
// server. Pure: no supabase, no fetch. Spec 2026-09-25-staff-desk-booking-link.

export const MIN_MONTHS = 3; // the legal minimum at all three properties
export const MAX_MONTHS = 36; // quoteFor clamps to 36, so we stop there too

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f-]{36}$/i;

const clean = (v) => (typeof v === "string" ? v.trim() : "");

function isRealDate(s) {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Returns { ok: true, value } or { ok: false, errors: [field, ...] }. */
export function validateDeskBooking(body, today = new Date()) {
  const b = body || {};
  const s = b.student || {};
  const errors = [];

  const pin = clean(String(b.pin ?? ""));
  if (!/^\d{6}$/.test(pin)) errors.push("pin");

  const room_id = clean(b.room_id);
  if (!UUID.test(room_id)) errors.push("room_id");

  const move_in = clean(b.move_in);
  const todayIso = new Date(today.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10); // SGT
  if (!isRealDate(move_in) || move_in < todayIso) errors.push("move_in");

  const months = Number(b.months);
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) errors.push("months");

  const name = clean(s.name);
  if (name.length < 2) errors.push("name");
  const email = clean(s.email).toLowerCase();
  if (!EMAIL.test(email)) errors.push("email");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      pin, room_id, move_in, months,
      student: { name, email, phone: clean(s.phone) || null, nationality: clean(s.nationality) || null },
    },
  };
}

/** Last day of an N-month licence: the day before the same date N months on. */
export function tenancyEnd(startIso, months) {
  const [y, m, d] = startIso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

/** How far a student has got, from a desk_bookings_for_pin row. */
export function deskStage(row, now = new Date()) {
  if (row.cancelled) return "cancelled";
  if (row.deposit_at) return "deposit";
  if (row.ta_signed_at) return "agreement";
  if (row.id_at) return "id";
  if (row.details_at) return "details";
  if (row.signed_up) return "signedUp";
  if (row.invite_expires_at && new Date(row.invite_expires_at) < now) return "expired";
  return "linkSent";
}
