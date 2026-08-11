// src/lib/partnerAuth.js
//
// Partner API key handling. Pure on purpose, same reasoning as
// listingCanonical.js: what authenticates a partner is testable without a
// network. Keys look like lzb_live_<32 random bytes, base64url>; only the
// sha256 of the whole string is ever stored.

import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "lzb_live_";

export function mintKey() {
  return KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function hashKey(key) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function parseAuthHeader(header) {
  if (!header || typeof header !== "string") return null;
  const m = header.match(/^bearer\s+(\S+)$/i);
  if (!m) return null;
  return m[1].startsWith(KEY_PREFIX) ? m[1] : null;
}

/** Fixed-window limiter decision. `used` is this request's slot number from
 * the atomic counter bump (count AFTER increment, so the first request of a
 * minute arrives as 1). The old read-then-check version raced: 75 concurrent
 * requests each read the log before any row landed and all passed. */
export function allowRequest(used, limitPerMin) {
  return used <= limitPerMin;
}
