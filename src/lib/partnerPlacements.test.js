// src/lib/partnerPlacements.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { buildPlacementPatch, PLACEMENT_STATUSES } from "./partnerPlacements.js";

const NOW = "2026-08-10T16:00:00Z";

test("statuses mirror the listing_placements check constraint", () => {
  assert.deepEqual([...PLACEMENT_STATUSES].sort(),
    ["ERROR", "LIVE", "NOT_LISTED", "PAUSED", "PENDING"]);
});

test("maps allowed fields and stamps timestamps from flags", () => {
  const p = buildPlacementPatch(
    { external_id: "rm-123", url: "https://roomies.sg/x", status: "LIVE", pushed: true, verified: true, drift: { price: [1500, 1550] }, error: null },
    NOW
  );
  assert.deepEqual(p, {
    external_id: "rm-123",
    url: "https://roomies.sg/x",
    status: "LIVE",
    last_pushed_at: NOW,
    last_verified_at: NOW,
    last_drift: { price: [1500, 1550] },
    last_error: null,
  });
});

test("omits what was not sent and never stamps unflagged timestamps", () => {
  assert.deepEqual(buildPlacementPatch({ verified: true }, NOW), { last_verified_at: NOW });
  assert.deepEqual(buildPlacementPatch({}, NOW), {});
});

test("refuses an unknown status", () => {
  assert.throws(() => buildPlacementPatch({ status: "SHINY" }, NOW));
});
