// The greeting at the top of the room desk, and the first-run tour flag.
//
// Both are pure so they can be tested without a browser. The desk is opened by
// captains in Singapore and by a channel partner in China, which happen to be
// the same offset, but the boundaries are read off the viewer's own clock
// rather than a fixed timezone so this stays correct if either moves.

/** Dictionary keys, not words. The desk renders in two languages. */
export const GREETING_KEYS = {
  morning: "staff.greet.morning",
  afternoon: "staff.greet.afternoon",
  evening: "staff.greet.evening",
};

/**
 * Which greeting belongs to this moment.
 *
 * Midnight to 11:59 is morning, noon to 17:59 afternoon, 18:00 onwards
 * evening. Three buckets rather than four: Chinese has 中午好 for the hour
 * around noon, but a fourth boundary buys a wording argument and no clarity.
 */
export function greetingKey(date) {
  const h = date.getHours();
  if (h < 12) return GREETING_KEYS.morning;
  if (h < 18) return GREETING_KEYS.afternoon;
  return GREETING_KEYS.evening;
}

// ── the first-run tour ──────────────────────────────────────────────────────

/** Version in the key, so rewriting the tour can show it again to everyone
 *  without hunting for a flag to clear. */
export const TOUR_KEY = "lzb-staff-tour-v1";

/** Five steps. Each resolves to a title and a body in both dictionaries. */
export const TOUR_STEPS = [
  "staff.tour.what",
  "staff.tour.search",
  "staff.tour.card",
  "staff.tour.badges",
  "staff.tour.ladder",
];

/**
 * Has this browser been shown the tour?
 *
 * Anything unparseable counts as not seen. Showing a five step tour a second
 * time is a small annoyance; never showing it because a stray value was
 * mistaken for a flag is a first-time user with no idea what they are reading.
 */
export function tourSeen(raw) {
  if (!raw) return false;
  try {
    return JSON.parse(raw)?.seen === true;
  } catch {
    return false;
  }
}

export function buildTourSeen() {
  return JSON.stringify({ seen: true });
}
