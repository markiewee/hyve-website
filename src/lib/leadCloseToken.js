/**
 * Signed one-way tokens for the lead opt-out link.
 *
 * The link sits in an email and resolves to a public URL that closes a lead,
 * so the id alone cannot be the credential: anyone could walk the table by
 * guessing uuids. The token is `base64url(leadId).hmac`, and verification
 * recomputes the HMAC over the decoded id rather than trusting the payload.
 *
 * There is deliberately no expiry. A "stop emailing me" link that stops
 * working is worse than useless: the one person guaranteed to click a stale
 * one is someone who has been ignoring us for months, which is exactly who we
 * most need to hear from.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function sig(leadId, secret) {
  return b64url(createHmac("sha256", secret).update(leadId).digest()).slice(0, 22);
}

export function signLeadToken(leadId, secret) {
  return `${b64url(leadId)}.${sig(leadId, secret)}`;
}

/**
 * @returns {string|null} the lead id, or null if the token is absent,
 *   malformed, or not signed with this secret.
 */
export function verifyLeadToken(token, secret) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let leadId;
  try {
    leadId = Buffer.from(
      parts[0].replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
  } catch {
    return null;
  }
  if (!leadId) return null;

  const expected = Buffer.from(sig(leadId, secret));
  const given = Buffer.from(parts[1]);
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? leadId : null;
}
