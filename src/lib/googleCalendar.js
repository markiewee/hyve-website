// ──────────────────────────────────────────────────────────────────────
// Google Calendar integration for Lazybee Viewing Booking V2
//
// Used by /api/book/* routes to:
//   - Read busy ranges on the "Lazybee Viewings" calendar
//   - Compute free 30-min slots within configured booking bands
//   - Create/cancel events when prospects book/cancel
//
// All times Asia/Singapore (UTC+8). Be explicit — never naive UTC.
// Server-only module (uses node googleapis SDK; do not import in browser).
// ──────────────────────────────────────────────────────────────────────

import { google } from "googleapis";

const TZ = "Asia/Singapore";
const TZ_OFFSET_MINUTES = 8 * 60; // SGT is UTC+8 year-round (no DST)

// ── ENV ────────────────────────────────────────────────────────────────
function env(name, fallback = undefined) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

// ── OAuth client (refresh-token based, server-side) ───────────────────
export function getOAuthClient({ withRefreshToken = true } = {}) {
  const clientId = env("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = env("GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    "https://lazybee.sg/api/booking/auth-callback";

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (withRefreshToken) {
    const refreshToken = env("GOOGLE_OAUTH_REFRESH_TOKEN");
    oauth2.setCredentials({ refresh_token: refreshToken });
  }

  return oauth2;
}

function getCalendarClient() {
  const auth = getOAuthClient();
  return google.calendar({ version: "v3", auth });
}

function getCalendarId() {
  return env("LAZYBEE_VIEWINGS_CAL_ID");
}

// ── Free/busy lookup ──────────────────────────────────────────────────
/**
 * Returns busy intervals on the Lazybee Viewings calendar between startISO/endISO.
 * @param {string} startISO ISO 8601 with timezone
 * @param {string} endISO   ISO 8601 with timezone
 * @returns {Promise<Array<{start: string, end: string}>>}
 */
export async function listFreeBusy(startISO, endISO) {
  const cal = getCalendarClient();
  const calendarId = getCalendarId();
  const r = await cal.freebusy.query({
    requestBody: {
      timeMin: startISO,
      timeMax: endISO,
      timeZone: TZ,
      items: [{ id: calendarId }],
    },
  });
  const busy = r.data.calendars?.[calendarId]?.busy || [];
  return busy.map((b) => ({ start: b.start, end: b.end }));
}

// ── Event create / cancel ─────────────────────────────────────────────
/**
 * Create an event on the Lazybee Viewings calendar.
 * @param {{summary: string, description?: string, start: string, end: string, attendees?: string[]}} args
 *        start/end are ISO 8601 with offset (e.g. "2026-05-10T11:00:00+08:00")
 * @returns {Promise<{id: string, htmlLink: string}>}
 */
export async function createEvent({ summary, description = "", start, end, attendees = [] }) {
  const cal = getCalendarClient();
  const calendarId = getCalendarId();
  const r = await cal.events.insert({
    calendarId,
    sendUpdates: "none", // we send our own emails via Resend
    requestBody: {
      summary,
      description,
      start: { dateTime: start, timeZone: TZ },
      end: { dateTime: end, timeZone: TZ },
      attendees: attendees.map((email) => ({ email })),
      reminders: { useDefault: false }, // we send our own
    },
  });
  return { id: r.data.id, htmlLink: r.data.htmlLink };
}

/**
 * Cancel (delete) an event on the Lazybee Viewings calendar.
 * Idempotent — swallows 404/410 if the event is already gone.
 */
export async function cancelEvent(eventId) {
  if (!eventId) return;
  const cal = getCalendarClient();
  const calendarId = getCalendarId();
  try {
    await cal.events.delete({
      calendarId,
      eventId,
      sendUpdates: "none",
    });
  } catch (err) {
    const status = err?.code || err?.response?.status;
    if (status === 404 || status === 410) return; // already gone
    throw err;
  }
}

// ── Slot computation ──────────────────────────────────────────────────

/**
 * Returns the day-of-week classification for slot bands.
 * @param {Date} d
 * @returns {"weekday" | "weekend"}
 */
function bandKeyForDate(d) {
  // d is interpreted in SGT here. Caller passes a date constructed in SGT.
  const dow = d.getDay();
  return dow === 0 || dow === 6 ? "weekend" : "weekday";
}

/**
 * Build an SGT ISO string (with +08:00 offset) for a given Y-M-D and HH:MM.
 */
function sgtIsoFromParts(y, m, d, hh, mm) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00+08:00`;
}

/**
 * Parse "HH:MM" into [hours, minutes].
 */
function parseHHMM(s) {
  const [hh, mm] = s.split(":").map((n) => parseInt(n, 10));
  return [hh, mm || 0];
}

function getBookingBands() {
  const raw = process.env.BOOKING_BANDS;
  if (!raw) {
    return {
      weekday: ["19:00-21:00"],
      weekend: ["11:00-15:00"],
    };
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("Invalid BOOKING_BANDS JSON, using defaults:", err);
    return { weekday: ["19:00-21:00"], weekend: ["11:00-15:00"] };
  }
}

function getLeadTimeHours() {
  return parseInt(process.env.BOOKING_LEAD_TIME_HOURS || "12", 10);
}

function getHorizonDays() {
  return parseInt(process.env.BOOKING_HORIZON_DAYS || "14", 10);
}

const SLOT_MINUTES = 30;

/**
 * Returns true if [aStart, aEnd) overlaps [bStart, bEnd) (epoch ms).
 */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Compute free 30-min slots for a given date and propertyCode.
 * @param {string} date YYYY-MM-DD (interpreted as SGT calendar date)
 * @param {string} propertyCode e.g. "IH" / "CP" / "TG" — currently informational;
 *                 future: per-property bands. Spec uses one shared cal for now.
 * @returns {Promise<Array<{start: string, end: string}>>}  (ISO with +08:00)
 */
export async function getAvailableSlots(date, propertyCode /* eslint-disable-line no-unused-vars */) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date '${date}', expected YYYY-MM-DD`);
  }

  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  // Construct a Date that represents midnight SGT on that calendar day.
  // Trick: treat YMD as UTC midnight, then subtract the SGT offset to get
  // the actual UTC instant of "00:00 SGT".
  const sgtMidnightUtcMs = Date.UTC(y, m - 1, d, 0, 0) - TZ_OFFSET_MINUTES * 60 * 1000;
  const dayStart = new Date(sgtMidnightUtcMs);
  const dayEnd = new Date(sgtMidnightUtcMs + 24 * 60 * 60 * 1000);

  // SGT calendar weekday for band selection
  // (we built dayStart as exactly SGT midnight so its UTC getDay reflects SGT day)
  // To avoid TZ bugs use a Date in SGT — easiest: use the original parts.
  const sgtDate = new Date(Date.UTC(y, m - 1, d));
  const bandKey = bandKeyForDate(sgtDate);

  const bands = getBookingBands()[bandKey] || [];
  const leadTimeMs = getLeadTimeHours() * 60 * 60 * 1000;
  const horizonMs = getHorizonDays() * 24 * 60 * 60 * 1000;

  const now = Date.now();
  const earliest = now + leadTimeMs;
  const horizonCutoff = now + horizonMs;

  // Generate candidate slots
  /** @type {Array<{startMs: number, endMs: number, startIso: string, endIso: string}>} */
  const candidates = [];
  for (const band of bands) {
    const [from, to] = band.split("-");
    const [fromH, fromM] = parseHHMM(from);
    const [toH, toM] = parseHHMM(to);

    const bandStartMs = Date.UTC(y, m - 1, d, fromH, fromM) - TZ_OFFSET_MINUTES * 60 * 1000;
    const bandEndMs = Date.UTC(y, m - 1, d, toH, toM) - TZ_OFFSET_MINUTES * 60 * 1000;

    // Walk in 30-min increments; track current SGT HH:MM directly (no DST in SGT).
    let curMin = fromH * 60 + fromM;
    const endMin = toH * 60 + toM;
    let cursorMs = bandStartMs;
    while (curMin + SLOT_MINUTES <= endMin) {
      const startMs = cursorMs;
      const endMs = cursorMs + SLOT_MINUTES * 60 * 1000;
      if (startMs >= earliest && startMs <= horizonCutoff) {
        const sH = Math.floor(curMin / 60);
        const sM = curMin % 60;
        const slotEndMin = curMin + SLOT_MINUTES;
        const eH = Math.floor(slotEndMin / 60);
        const eM = slotEndMin % 60;
        candidates.push({
          startMs,
          endMs,
          startIso: sgtIsoFromParts(y, m, d, sH, sM),
          endIso: sgtIsoFromParts(y, m, d, eH, eM),
        });
      }
      curMin += SLOT_MINUTES;
      cursorMs += SLOT_MINUTES * 60 * 1000;
    }
  }

  if (candidates.length === 0) return [];

  // Subtract busy intervals from the cal
  const busy = await listFreeBusy(dayStart.toISOString(), dayEnd.toISOString());
  const busyMs = busy.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const free = candidates.filter(
    (c) => !busyMs.some((b) => overlaps(c.startMs, c.endMs, b.start, b.end))
  );

  return free.map((c) => ({ start: c.startIso, end: c.endIso }));
}

/**
 * Re-check whether a specific slot is still free against the cal AND DB.
 * Used as a race guard inside the create transaction.
 *
 * @param {string} slotStartIso ISO with offset
 * @param {string} slotEndIso   ISO with offset
 * @returns {Promise<boolean>}
 */
export async function isSlotStillFree(slotStartIso, slotEndIso) {
  const startMs = new Date(slotStartIso).getTime();
  const endMs = new Date(slotEndIso).getTime();
  // Pad each side by 1 second to be safe with API rounding
  const busy = await listFreeBusy(
    new Date(startMs - 1000).toISOString(),
    new Date(endMs + 1000).toISOString()
  );
  return !busy.some((b) => {
    const bStart = new Date(b.start).getTime();
    const bEnd = new Date(b.end).getTime();
    return overlaps(startMs, endMs, bStart, bEnd);
  });
}

export const _internal = {
  TZ,
  TZ_OFFSET_MINUTES,
  SLOT_MINUTES,
  getBookingBands,
  getLeadTimeHours,
  getHorizonDays,
  bandKeyForDate,
  sgtIsoFromParts,
};
