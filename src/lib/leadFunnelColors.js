// src/lib/leadFunnelColors.js
// Spec: docs/specs/2026-05-15-kanban-sankey-analytics.md §4
//
// Hex equivalents of the Tailwind classes used in LeadCard's SOURCE_BADGES.
// We use the *background* shade for Sankey node fill and the *text* shade
// for the source label so the funnel reads like the Kanban cards.

export const SOURCE_FILL = {
  airbnb: "#fecdd3", // rose-100
  propertyguru: "#fed7aa", // orange-100
  carousell: "#fee2e2", // red-100
  roomies: "#dbeafe", // blue-100
  facebook: "#dbeafe", // blue-100
  telegram: "#e0f2fe", // sky-100
  whatsapp_direct: "#dcfce7", // green-100
  agent_referral: "#f3e8ff", // purple-100
  referral: "#f3e8ff",
  organic: "#d1fae5", // emerald-100
  other: "#f1f5f9", // slate-100
};

export const SOURCE_TEXT = {
  airbnb: "#be123c",
  propertyguru: "#c2410c",
  carousell: "#b91c1c",
  roomies: "#1d4ed8",
  facebook: "#1e40af",
  telegram: "#0369a1",
  whatsapp_direct: "#15803d",
  agent_referral: "#7e22ce",
  referral: "#7e22ce",
  organic: "#047857",
  other: "#334155",
};

export const POOL_FILL = "#0f172a"; // slate-900
export const POOL_TEXT = "#ffffff";

export const OUTCOME_FILL = {
  active: "#10b981", // emerald-500
  won: "#16a34a", // green-600
  lost: "#e11d48", // rose-600
  cold: "#64748b", // slate-500
};

export const OUTCOME_TEXT = "#ffffff";

const _warned = new Set();
export function sourceFill(name) {
  if (!(name in SOURCE_FILL) && !_warned.has(name)) {
    _warned.add(name);
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[leadFunnel] unknown source "${name}", defaulting to slate`);
    }
  }
  return SOURCE_FILL[name] ?? SOURCE_FILL.other;
}
export function sourceText(name) {
  return SOURCE_TEXT[name] ?? SOURCE_TEXT.other;
}
