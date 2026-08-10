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

/** Fixed-window limiter decision: `count` requests already seen this minute. */
export function allowRequest(count, limitPerMin) {
  return count < limitPerMin;
}
