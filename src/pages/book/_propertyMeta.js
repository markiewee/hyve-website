// Shared property metadata for the V2 booking flow.
// Single source of truth for the public /book/* pages and admin calendar tab.
// Codes (TG/IH/CP) match the `properties.code` column in Supabase and the API
// contract — `?property=IH` etc.

export const PROPERTY_META = {
  TG: {
    code: "TG",
    name: "Thomson Grove",
    blurb: "Quiet north-side block, 5-min walk to Lentor MRT (TEL).",
    address: "Thomson Grove, 588 Yio Chu Kang Road, Singapore 787072",
    image: "/properties/thomson-grove.jpg",
    rooms: 6,
    priceFrom: 800,
    priceTo: 2200,
    meetingPoint: "Tell the guard you're visiting Hyve at Block 588.",
    badge: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-500" },
  },
  IH: {
    code: "IH",
    name: "Ivory Heights",
    blurb: "Steps from Jurong East MRT, IMM and Westgate. NUS-friendly.",
    address: "Ivory Heights, 122 Jurong East St 13, Singapore 600122",
    image: "/properties/ivory-heights.jpg",
    rooms: 7,
    priceFrom: 800,
    priceTo: 1190,
    meetingPoint: "Tell the guard you're visiting Hyve at Block 122.",
    badge: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-500" },
  },
  CP: {
    code: "CP",
    name: "Chiltern Park",
    blurb: "Lush Serangoon enclave, near Lorong Chuan MRT (CCL).",
    address: "Chiltern Park, 135 Serangoon Avenue 3, Singapore 556112",
    image: "/properties/chiltern-park.jpg",
    rooms: 6,
    priceFrom: 900,
    priceTo: 2200,
    meetingPoint: "Tell the guard you're visiting Hyve at Block 135.",
    badge: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-500" },
  },
};

export const PROPERTY_CODES = Object.keys(PROPERTY_META);

// Common aliases people type or paste — Members Dashboard uses CHP, some
// internal docs use TGV/THM, etc. Keep this loose so a wrong code in a
// pasted link still resolves to the right property.
const PROPERTY_ALIASES = {
  CHP: "CP",
  CHILTERN: "CP",
  THOMSON: "TG",
  TGV: "TG",
  IVORY: "IH",
  IHJ: "IH",
};

export function getPropertyByCode(code) {
  if (!code) return null;
  const k = code.toUpperCase();
  return PROPERTY_META[k] || PROPERTY_META[PROPERTY_ALIASES[k]] || null;
}

// Allowed booking-source codes (kept in sync with the API contract).
// Anything outside this set falls back to "organic".
export const BOOKING_SOURCES = new Set([
  "roomies",
  "carousell",
  "pg",
  "ig",
  "wa",
  "organic",
  "fb",
  "google",
  "referral",
]);

export function normalizeSource(raw) {
  if (!raw) return "organic";
  const s = String(raw).toLowerCase().trim();
  return BOOKING_SOURCES.has(s) ? s : "organic";
}

// SG / MY phone validator — matches the API contract.
// Expects the leading "+" already present.
export function isValidPhone(phone) {
  if (!phone) return false;
  const stripped = phone.replace(/\s|-/g, "");
  // SG: +65 followed by 8 digits
  if (/^\+65\d{8}$/.test(stripped)) return true;
  // MY: +60 followed by 9–10 digits
  if (/^\+60\d{9,10}$/.test(stripped)) return true;
  return false;
}

// Captain WhatsApp fallback — generic Hyve number until the API resolves a per-property captain.
export const HYVE_WA_NUMBER = "6580885410";

export function buildCaptainWaLink({ phone, propertyName, slotStart }) {
  const number = (phone || HYVE_WA_NUMBER).replace(/[^\d]/g, "");
  const text = encodeURIComponent(
    `Hi, just confirming my Hyve viewing at ${propertyName}${
      slotStart ? ` on ${slotStart}` : ""
    }.`
  );
  return `https://wa.me/${number}?text=${text}`;
}
