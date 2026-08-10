// src/lib/partnerWindows.js
//
// Collapse room_calendar rows into anonymous date windows for the partner
// API. The input rows are whatever the caller selected (ACTIVE, blocks=true);
// the output deliberately knows nothing but dates and a two-value status.
// Kind, source, notes and identity never pass through here, and the test
// asserts the exact key set to keep it that way.

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (iso) => Date.parse(iso + "T00:00:00Z");
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Merge blocking rows into disjoint [start, end] date windows, clipped to
 * [from, from + horizonDays]. `ends_on: null` reads as occupied forever. */
export function unavailableWindows(rows, { from, horizonDays }) {
  const fromMs = toMs(from);
  const horizonMs = fromMs + horizonDays * DAY_MS;
  const spans = rows
    .map((r) => ({
      start: Math.max(toMs(r.starts_on), fromMs),
      end: Math.min(r.ends_on == null ? horizonMs : toMs(r.ends_on), horizonMs),
    }))
    .filter((s) => s.end >= s.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + DAY_MS) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged.map((s) => ({ start: toIso(s.start), end: toIso(s.end) }));
}

/** Full calendar: open gaps interleaved with unavailable windows. */
export function calendarView(rows, opts) {
  const busy = unavailableWindows(rows, opts);
  const fromMs = toMs(opts.from);
  const horizonMs = fromMs + opts.horizonDays * DAY_MS;
  const view = [];
  let cursor = fromMs;
  for (const w of busy) {
    const wStart = toMs(w.start);
    if (wStart > cursor) view.push({ start: toIso(cursor), end: toIso(wStart - DAY_MS), status: "open" });
    view.push({ start: w.start, end: w.end, status: "unavailable" });
    cursor = toMs(w.end) + DAY_MS;
  }
  if (cursor <= horizonMs) view.push({ start: toIso(cursor), end: toIso(horizonMs), status: "open" });
  return view;
}
