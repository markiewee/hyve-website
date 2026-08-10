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

export function buildUnlock(now) {
  return { v: MARK, exp: now + UNLOCK_DAYS * 86400000 };
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
