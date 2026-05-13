// lib/classify-helpers.js
const AGENT_PATTERNS = [
  /I'?m .{2,40} received your enquiry from PropertyGuru/i,
  /\bPropNex\b/i,
  /\bHuttons\b/i,
  /\bOrangeTee\b/i,
  /\bERA\b/i,
  /\bmy PA reached out\b/i,
  /\bmarketing your unit\b/i,
  /\bpool of tenants\b/i,
];

export function isAgentMessage(text) {
  if (!text) return false;
  return AGENT_PATTERNS.some((re) => re.test(text));
}

const INTERNAL_PHONES = new Set([
  "+6581333757", // Mark
]);

export function isInternalPhone(phone) {
  return INTERNAL_PHONES.has(phone);
}

export function normaliseE164(raw) {
  const digits = (raw || "").replace(/[^0-9+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 8) return `+65${digits}`;
  return `+${digits}`;
}
