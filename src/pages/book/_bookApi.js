// Thin wrapper around the /api/booking/* contract from the V2 spec.
// Backend agent is building these in parallel — this file is the only place
// the frontend talks to those endpoints, so when the contract evolves we have
// one knob to turn.

const BASE = ""; // same-origin in dev + prod (vercel rewrites /api/* to functions)

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty body is fine */
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function fetchSlots({ property, date, room, signal } = {}) {
  const qs = new URLSearchParams({ property, date });
  if (room) qs.set("room", room);
  return jsonFetch(`/api/booking/slots?${qs.toString()}`, { signal });
}

export function createBooking(payload) {
  return jsonFetch(`/api/booking/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCancelDetails(token, signal) {
  return jsonFetch(`/api/booking/cancel?token=${encodeURIComponent(token)}`, { signal });
}

export function confirmCancel(token) {
  return jsonFetch(`/api/booking/cancel?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
}

// Admin-side helpers (backend may expose later — used by the admin calendar tab).
export function blockSlot({ property, slot_start, slot_end, reason }) {
  return jsonFetch(`/api/booking/block`, {
    method: "POST",
    body: JSON.stringify({ property, slot_start, slot_end, reason }),
  });
}

export function cancelViewingAdmin(viewing_id) {
  return jsonFetch(`/api/booking/admin-cancel`, {
    method: "POST",
    body: JSON.stringify({ viewing_id }),
  });
}
