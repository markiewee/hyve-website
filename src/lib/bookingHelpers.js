// Shared helpers for /api/book/* routes
// Server-only — uses node crypto.

import crypto from "crypto";

// Property code mapping (CHP/IH/TG → friendly long names live in properties.name)
export const PROPERTY_CODES = {
  CP: "CHP", // tolerated alias
  CHP: "CHP",
  IH: "IH",
  TG: "TG",
};

export function normalizePropertyCode(code) {
  if (!code) return null;
  const upper = String(code).trim().toUpperCase();
  return PROPERTY_CODES[upper] || upper;
}

// SG = +65XXXXXXXX, MY = +60XXXXXXXXX, default leave as-is.
// Strip spaces/dashes/parens; ensure starting +.
export function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d+]/g, "");
  if (!s) return null;

  // If user typed a local number without country code, infer from length.
  if (!s.startsWith("+")) {
    if (s.startsWith("65") && s.length === 10) s = "+" + s;
    else if (s.startsWith("60") && (s.length === 11 || s.length === 12)) s = "+" + s;
    else if (s.length === 8) s = "+65" + s; // 8-digit SG
    else if (s.length === 9 || s.length === 10) s = "+60" + s; // MY local
    else s = "+" + s;
  }
  return s;
}

export function generateCancelToken() {
  return crypto.randomBytes(32).toString("hex");
}

export const VALID_SOURCES = [
  "roomies",
  "carousell",
  "pg",
  "ig",
  "wa",
  "organic",
  "admin",
  "direct",
];

export function normalizeSource(s) {
  if (!s) return "organic";
  const v = String(s).trim().toLowerCase();
  return VALID_SOURCES.includes(v) ? v : "organic";
}

export function publicBaseUrl() {
  return process.env.PUBLIC_SITE_URL || "https://hyve.sg";
}

export function cancelUrlFor(token) {
  return `${publicBaseUrl()}/book/cancel?token=${encodeURIComponent(token)}`;
}

// Validate ISO with offset (e.g. 2026-05-10T11:00:00+08:00)
export function isValidSgtIso(s) {
  if (!s || typeof s !== "string") return false;
  // Allow explicit +08:00, +0800, or trailing Z (we'll normalize)
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:?\d{2}|Z)$/.test(s);
}

export function snippet(s, max = 140) {
  if (!s) return "";
  return String(s).length > max ? String(s).slice(0, max) + "…" : String(s);
}
