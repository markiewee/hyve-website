// lib/room-photos.js
// Map Hyve room codes (e.g. "TG-STD1", "CP-MR") to local photo file paths.
//
// Convention: ~/Desktop/claudine/hyve-photos/{property-slug}/{SUFFIX}.jpg
// Property slugs: TG=thomson-grove, IH=ivory-heights, CP=chiltern-park
// Aliases: MR ↔ MBR (some properties use one or the other).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PROPERTY_SLUGS = {
  TG: "thomson-grove",
  IH: "ivory-heights",
  CP: "chiltern-park",
};

// Suffixes that have known alternate filename forms.
const SUFFIX_ALIASES = {
  MR: ["MR", "MBR"],
  MBR: ["MBR", "MR"],
};

export function defaultPhotoRoot() {
  return (
    process.env.HYVE_PHOTOS_DIR ||
    path.join(os.homedir(), "Desktop/claudine/hyve-photos")
  );
}

/**
 * Resolve a single room code to its photo path.
 * Returns null if no file matches.
 */
export function resolveRoomPhoto(roomCode, { root = defaultPhotoRoot(), fsImpl = fs } = {}) {
  if (!roomCode || typeof roomCode !== "string") return null;
  const idx = roomCode.indexOf("-");
  if (idx < 0) return null;
  const propPrefix = roomCode.slice(0, idx).toUpperCase();
  const suffix = roomCode.slice(idx + 1).toUpperCase();
  const slug = PROPERTY_SLUGS[propPrefix];
  if (!slug) return null;

  const candidates = SUFFIX_ALIASES[suffix] || [suffix];
  for (const c of candidates) {
    const p = path.join(root, slug, `${c}.jpg`);
    if (fsImpl.existsSync(p)) return p;
  }
  return null;
}

/**
 * Resolve a list of room codes to { code, path } pairs.
 * Missing photos are dropped (or returned with path: null if includeMissing=true).
 */
export function resolveRoomPhotos(roomCodes, opts = {}) {
  const { includeMissing = false } = opts;
  const out = roomCodes.map((code) => ({ code, path: resolveRoomPhoto(code, opts) }));
  return includeMissing ? out : out.filter((p) => p.path !== null);
}
