// Where the staff room desk remembers that this browser has been let in.
//
// localStorage rather than a cookie: there is no server session to attach a
// cookie to, the whole site is static plus Supabase. Thirty days because a
// captain should not retype a PIN on every shift, and revoking a person is done
// by disabling their row, which bites the next time they unlock.
//
// This is a doormat, not a lock. Anyone can hand-edit localStorage, and the room
// data behind it is anon-readable anyway so the public booking site can render
// listings. The version marker below is not security, it just stops a stale or
// hand-typed payload being mistaken for a real unlock.

export const UNLOCK_DAYS = 30;
export const STORAGE_KEY = "lzb-staff-unlock";

const MARK = "staff-pin-v1";

export function buildUnlock(now, pin) {
  return { v: MARK, exp: now + UNLOCK_DAYS * 86400000, pin: pin ?? null };
}

export function readUnlock(raw, now) {
  if (!raw) return false;
  try {
    const u = JSON.parse(raw);
    if (!u || u.v !== MARK || typeof u.exp !== "number") return false;
    return u.exp > now;
  } catch {
    return false;
  }
}

/**
 * The PIN itself, when the unlock is still valid.
 *
 * A deliberate weakening, written down rather than discovered later. The
 * housemate roster is read through housemates_for_staff_pin, which takes the
 * PIN, and until now the PIN was thrown away the moment redeem_staff_pin
 * accepted it. The alternatives were a session-token round trip, which is real
 * machinery for a credential this file already calls a doormat, or exposing the
 * roster to plain anon, which would put nationality and lease dates in reach of
 * anyone holding the anon key that ships in the bundle.
 *
 * Keeping the PIN in the record that already grants this exact view hands its
 * holder nothing they do not have. Records written before this change simply
 * have no pin, and the roster stays empty for them until the next unlock.
 */
export function readPin(raw, now) {
  if (!readUnlock(raw, now)) return null;
  try {
    const pin = JSON.parse(raw).pin;
    return typeof pin === "string" && pin.length === 6 ? pin : null;
  } catch {
    return null;
  }
}
