// src/lib/partnerPlacements.js
//
// Internal-scope placement reporting: an agent refreshed a listing on a
// platform and tells the API what it did. This module turns that report into
// a listing_placements patch. Pure so the field mapping and timestamp
// stamping are tested; unknown statuses are refused loudly rather than
// bounced by the database check constraint mid-request.

export const PLACEMENT_STATUSES = new Set([
  "NOT_LISTED", "PENDING", "LIVE", "PAUSED", "ERROR",
]);

export function buildPlacementPatch(input, nowIso) {
  const i = input ?? {};
  const patch = {};
  if (i.external_id !== undefined) patch.external_id = i.external_id;
  if (i.url !== undefined) patch.url = i.url;
  if (i.status !== undefined) {
    if (!PLACEMENT_STATUSES.has(i.status)) {
      throw new Error(`unknown placement status "${i.status}"; one of: ${[...PLACEMENT_STATUSES].join(", ")}`);
    }
    patch.status = i.status;
  }
  if (i.pushed) patch.last_pushed_at = nowIso;
  if (i.verified) patch.last_verified_at = nowIso;
  if (i.drift !== undefined) patch.last_drift = i.drift;
  if (i.error !== undefined) patch.last_error = i.error;
  // What the agent actually saw on the platform, verbatim. Observation time
  // is ours to stamp: agents report "now", not a claimed timestamp.
  if (i.observed !== undefined) {
    patch.observed_state = i.observed;
    patch.observed_at = nowIso;
  }
  if (i.expires_at !== undefined) patch.expires_at = i.expires_at;
  return patch;
}
