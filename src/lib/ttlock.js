import { supabase } from "./supabase";

/**
 * TTLock API client, proxied through /api/portal/admin-actions (the server
 * holds the TTLock credentials). Mirrors the Aspire client pattern.
 */
export async function callTTLock(ttlock_action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/portal/admin-actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ action: "ttlock", ttlock_action, ...params }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `TTLock proxy error ${res.status}`);
  }
  return res.json();
}

/** All smart locks on the account. Returns [] when TTLock isn't configured. */
export async function listLocks() {
  try {
    const data = await callTTLock("list_locks");
    return Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
  } catch {
    // Not configured / unreachable → caller falls back to passcode-only mode.
    return [];
  }
}

const ALIAS = (lock) => (lock.lockAlias || lock.lockName || "").toLowerCase();
const MAIN_KEYWORDS = ["main", "front", "entrance", "gate"];

/** Find the smart lock for a room unit_code (alias contains the code). */
export function matchRoomLock(locks, unitCode) {
  if (!unitCode) return null;
  const code = unitCode.toLowerCase();
  return locks.find((l) => ALIAS(l).includes(code)) || null;
}

/** Find the smart lock for a property's main door. */
export function matchMainLock(locks, propertyCode) {
  const pc = (propertyCode || "").toLowerCase();
  return (
    locks.find((l) => {
      const a = ALIAS(l);
      return a.includes(pc) && MAIN_KEYWORDS.some((k) => a.includes(k));
    }) ||
    locks.find((l) => ALIAS(l) === `${pc}-main`) ||
    null
  );
}
