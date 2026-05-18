// ──────────────────────────────────────────────────────────────────────
// Viewing clustering resolver — Lazybee Booking V3
// Spec: docs/specs/2026-05-15-viewing-clustering.md
//
// Pure JS, no DB, no React. Used both by the API route (server-side) and
// the unit tests. Browser-safe.
// ──────────────────────────────────────────────────────────────────────

const SLOT_MS = 15 * 60 * 1000;
const TRAVEL_BUFFER_MS = 30 * 60 * 1000;
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // SGT — no DST

// Window definitions: day-of-week (Sun=0, Fri=5, Sat=6), key, SGT start/end hours
const WINDOW_DEFS = [
  { dow: 5, key: "fri-evening",   startH: 19, endH: 22 },
  { dow: 6, key: "sat-morning",   startH: 10, endH: 13 },
  { dow: 0, key: "sun-afternoon", startH: 16, endH: 18 },
];

export const SLOT_STATE = Object.freeze({
  OPEN_ANY:         "OPEN-ANY",
  PROP_RESERVED:    "PROP-RESERVED",
  BLOCKED_BUFFER:   "BLOCKED-BUFFER",
  BLOCKED_CONFLICT: "BLOCKED-CONFLICT", // overlaps a non-viewing GCal event
  BOOKED:           "BOOKED",
  WINDOW_CLOSED:    "WINDOW-CLOSED",
  OUT_OF_HORIZON:   "OUT-OF-HORIZON",
});

export const WINDOW_STATE = Object.freeze({
  CLOSED:    "CLOSED",       // no GCal event
  OPEN_ANY:  "OPEN-ANY",     // GCal event present, no anchor yet
  OPEN_PROP: "OPEN-PROP",    // anchor set (GCal pre-anchor or first-booker)
});

// ── Window enumeration ───────────────────────────────────────────────

/**
 * Returns the list of upcoming Fri/Sat/Sun viewing windows in the next N days,
 * starting from the day containing `now`. Windows whose end has already passed
 * are excluded.
 *
 * @param {Date} now
 * @param {number} horizonDays
 * @returns {Array<{key: string, dateIso: string, startMs: number, endMs: number}>}
 */
export function listUpcomingWindows(now, horizonDays = 7) {
  const out = [];
  // Express now in SGT to find today's SGT calendar date
  const sgtNow = new Date(now.getTime() + TZ_OFFSET_MS);
  const startOfTodaySgtUtcMs =
    Date.UTC(sgtNow.getUTCFullYear(), sgtNow.getUTCMonth(), sgtNow.getUTCDate(), 0, 0, 0)
    - TZ_OFFSET_MS; // shift back to UTC instant of "00:00 SGT today"

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const dayStartUtcMs = startOfTodaySgtUtcMs + dayOffset * 24 * 60 * 60 * 1000;
    // SGT day-of-week for this date
    const dayDow = new Date(dayStartUtcMs + TZ_OFFSET_MS).getUTCDay();
    const def = WINDOW_DEFS.find((w) => w.dow === dayDow);
    if (!def) continue;
    const startMs = dayStartUtcMs + def.startH * 60 * 60 * 1000;
    const endMs   = dayStartUtcMs + def.endH   * 60 * 60 * 1000;
    if (endMs <= now.getTime()) continue; // already past
    const dateIso = new Date(dayStartUtcMs + TZ_OFFSET_MS).toISOString().slice(0, 10);
    out.push({ key: def.key, dateIso, startMs, endMs });
  }
  return out;
}

// ── GCal matching ────────────────────────────────────────────────────

/**
 * Find the GCal event whose start time aligns with this window's start
 * (within ±5 minute tolerance for human imprecision).
 *
 * @param {{startMs:number}} window
 * @param {Array<{start: string, end: string, anchorProperty: string|null}>} gcalEvents
 * @returns {{anchorProperty: string|null}|null}
 */
function findGcalEventForWindow(window, gcalEvents) {
  const tolerance = 5 * 60 * 1000;
  return (
    gcalEvents.find((ev) => {
      const evStartMs = new Date(ev.start).getTime();
      return Math.abs(evStartMs - window.startMs) <= tolerance;
    }) || null
  );
}

// ── Cluster grouping ─────────────────────────────────────────────────

/**
 * Group adjacent same-property bookings into clusters within a window.
 * Returns clusters sorted by earliestMs, each containing earliest/latest
 * booked slot bounds for that property.
 */
function clusterBookings(bookings) {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime()
  );
  const byProperty = new Map();
  for (const b of sorted) {
    const startMs = new Date(b.slot_start).getTime();
    const endMs   = new Date(b.slot_end).getTime();
    const existing = byProperty.get(b.property_code);
    if (existing) {
      existing.earliestMs = Math.min(existing.earliestMs, startMs);
      existing.latestMs   = Math.max(existing.latestMs, endMs);
      existing.slots.push({ startMs, endMs });
    } else {
      byProperty.set(b.property_code, {
        property: b.property_code,
        earliestMs: startMs,
        latestMs: endMs,
        slots: [{ startMs, endMs }],
      });
    }
  }
  return Array.from(byProperty.values()).sort((a, b) => a.earliestMs - b.earliestMs);
}

function isSlotBooked(slotStartMs, bookings) {
  return bookings.some((b) => new Date(b.slot_start).getTime() === slotStartMs);
}

function isWindowEdge(slotStartMs, slotEndMs, window) {
  return slotStartMs === window.startMs || slotEndMs === window.endMs;
}

/**
 * Returns true if [slotStartMs, slotEndMs) overlaps any blocker interval.
 * Blockers are arbitrary GCal events (not booking windows, not viewings)
 * that mark Mark as unavailable inside an otherwise-open window.
 */
function slotHitsBlocker(slotStartMs, slotEndMs, blockers) {
  if (!blockers || blockers.length === 0) return false;
  return blockers.some((b) => {
    const bStart = new Date(b.start).getTime();
    const bEnd   = new Date(b.end).getTime();
    return slotStartMs < bEnd && bStart < slotEndMs;
  });
}

// ── Resolver ─────────────────────────────────────────────────────────

/**
 * Compute slot states for a single window from the perspective of a
 * specific property of interest.
 *
 * @param {Object} args
 * @param {'CP'|'IH'|'TG'} args.propertyOfInterest
 * @param {{startMs:number,endMs:number}} args.window
 * @param {{anchorProperty: string|null}|null} args.gcalEvent  null = closed
 * @param {Array<{slot_start:string, slot_end:string, property_code:string, status:string}>} args.bookings
 * @returns {{state: string, anchorProperty: string|null,
 *            slots: Array<{start:string,end:string,state:string}>}}
 */
export function resolveSlots({ propertyOfInterest, window, gcalEvent, bookings, blockers = [] }) {
  if (!gcalEvent) {
    return { state: WINDOW_STATE.CLOSED, anchorProperty: null, slots: [] };
  }

  // Anchor: GCal pre-anchor wins, else first-booker, else null (still open)
  let anchor = gcalEvent.anchorProperty || null;
  if (!anchor && bookings.length > 0) {
    const firstBooking = [...bookings].sort(
      (a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime()
    )[0];
    anchor = firstBooking.property_code;
  }

  const clusters = clusterBookings(bookings);
  const ownCluster = clusters.find((c) => c.property === propertyOfInterest) || null;

  const slots = [];
  for (let cursor = window.startMs; cursor + SLOT_MS <= window.endMs; cursor += SLOT_MS) {
    const slotStartMs = cursor;
    const slotEndMs   = cursor + SLOT_MS;
    const startIso = new Date(slotStartMs).toISOString();
    const endIso   = new Date(slotEndMs).toISOString();
    const isEdge   = isWindowEdge(slotStartMs, slotEndMs, window);

    // BOOKED takes priority
    if (isSlotBooked(slotStartMs, bookings)) {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.BOOKED });
      continue;
    }

    // GCal blocker (any non-booking-window, non-viewing event Mark dropped
    // on the Lazybee Viewings calendar) blocks the slot regardless of who
    // the anchor is. Checked after BOOKED so an active viewing keeps its
    // BOOKED label, but before any OPEN/PROP_RESERVED resolution.
    if (slotHitsBlocker(slotStartMs, slotEndMs, blockers)) {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.BLOCKED_CONFLICT });
      continue;
    }

    // No anchor → window wide open
    if (!anchor) {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.OPEN_ANY });
      continue;
    }

    // Anchor present.
    if (anchor === propertyOfInterest) {
      // Same-property prospect: their entire window is reserved for them,
      // unless extending here would block a downstream cross-property cluster
      // (Carl-from-the-spec scenario).
      const otherClusters = clusters.filter((c) => c.property !== propertyOfInterest);
      const wouldBlockDownstream = otherClusters.some((other) => {
        const newLatest   = ownCluster ? Math.max(ownCluster.latestMs,   slotEndMs)   : slotEndMs;
        const newEarliest = ownCluster ? Math.min(ownCluster.earliestMs, slotStartMs) : slotStartMs;
        if (other.earliestMs >= newLatest && other.earliestMs - newLatest < TRAVEL_BUFFER_MS) return true;
        if (newEarliest >= other.latestMs && newEarliest - other.latestMs < TRAVEL_BUFFER_MS) return true;
        return false;
      });
      slots.push({
        start: startIso,
        end: endIso,
        state: wouldBlockDownstream ? SLOT_STATE.BLOCKED_BUFFER : SLOT_STATE.PROP_RESERVED,
      });
      continue;
    }

    // Cross-property prospect.
    let withinAnchorClusterRange = false;
    let blockedByBuffer = false;
    for (const c of clusters) {
      // Within the cluster's range = PROP_RESERVED (for them, blocked for us)
      if (slotStartMs >= c.earliestMs && slotEndMs <= c.latestMs && c.property !== propertyOfInterest) {
        withinAnchorClusterRange = true;
        break;
      }
      // Buffer check both directions
      if (slotEndMs <= c.earliestMs && c.earliestMs - slotEndMs < TRAVEL_BUFFER_MS) {
        blockedByBuffer = true;
      }
      if (slotStartMs >= c.latestMs && slotStartMs - c.latestMs < TRAVEL_BUFFER_MS) {
        blockedByBuffer = true;
      }
    }

    if (withinAnchorClusterRange) {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.PROP_RESERVED });
    } else if (blockedByBuffer && !isEdge) {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.BLOCKED_BUFFER });
    } else {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.OPEN_ANY });
    }
  }

  const windowState = anchor ? WINDOW_STATE.OPEN_PROP : WINDOW_STATE.OPEN_ANY;
  return { state: windowState, anchorProperty: anchor, slots };
}

// ── Top-level builder ────────────────────────────────────────────────

/**
 * Build the complete `windows` payload for GET /api/booking/windows.
 *
 * @param {Object} args
 * @param {'CP'|'IH'|'TG'} args.propertyOfInterest
 * @param {Date} args.now
 * @param {Array<{start:string,end:string,anchorProperty:string|null}>} args.gcalEvents
 * @param {Array} args.allBookings  bookings inside the horizon
 * @param {number} [args.horizonDays=7]
 * @returns {Array}
 */
export function buildWindowsResponse({
  propertyOfInterest,
  now,
  gcalEvents,
  allBookings,
  blockers = [],
  horizonDays = 7,
}) {
  const upcomingWindows = listUpcomingWindows(now, horizonDays);
  return upcomingWindows.map((w) => {
    const gcalEvent = findGcalEventForWindow(w, gcalEvents);
    const windowBookings = allBookings.filter((b) => {
      const ms = new Date(b.slot_start).getTime();
      return ms >= w.startMs && ms < w.endMs;
    });
    // Keep blockers that overlap this window at all — even partial overlap
    // matters because a 1-hour blocker can clip multiple slot starts.
    const windowBlockers = blockers.filter((b) => {
      const bStart = new Date(b.start).getTime();
      const bEnd   = new Date(b.end).getTime();
      return bStart < w.endMs && bEnd > w.startMs;
    });
    const resolution = resolveSlots({
      propertyOfInterest,
      window: w,
      gcalEvent,
      bookings: windowBookings,
      blockers: windowBlockers,
    });
    const freeSlotCount = resolution.slots.filter(
      (s) =>
        s.state === SLOT_STATE.OPEN_ANY ||
        (s.state === SLOT_STATE.PROP_RESERVED && resolution.anchorProperty === propertyOfInterest)
    ).length;
    return {
      key: w.key,
      date: w.dateIso,
      window_start: new Date(w.startMs).toISOString(),
      window_end:   new Date(w.endMs).toISOString(),
      state: resolution.state,
      anchor_property: resolution.anchorProperty,
      free_slot_count: freeSlotCount,
      slots: resolution.slots,
    };
  });
}

// ── Server-side validator ────────────────────────────────────────────

/**
 * Validate a booking attempt against the cluster rules.
 * Returns `null` if valid, or `{ code, payload }` if rejected.
 *
 * Rejection codes (mirrored in the API response):
 *   - 'window-closed'        — no GCal event
 *   - 'slot-outside-window'  — slot doesn't fit the window range
 *   - 'slot-taken'           — exact slot already has an active booking
 *   - 'wrong-property'       — GCal pre-anchored to a different property
 *   - 'travel-buffer'        — cross-property buffer violation (with payload.earliest_allowed)
 *   - 'would-block-existing' — same-property extension would invalidate downstream
 */
export function validateBookingAttempt({
  propertyOfInterest,
  slotStartIso,
  window,
  gcalEvent,
  bookings,
  blockers = [],
}) {
  if (!gcalEvent) return { code: "window-closed", payload: {} };

  const slotStartMs = new Date(slotStartIso).getTime();
  const slotEndMs   = slotStartMs + SLOT_MS;

  if (slotStartMs < window.startMs || slotEndMs > window.endMs) {
    return { code: "slot-outside-window", payload: {} };
  }
  if (Number.isNaN(slotStartMs)) {
    return { code: "slot-outside-window", payload: {} };
  }

  if (isSlotBooked(slotStartMs, bookings)) {
    return { code: "slot-taken", payload: {} };
  }

  if (slotHitsBlocker(slotStartMs, slotEndMs, blockers)) {
    return { code: "slot-conflict", payload: {} };
  }

  if (gcalEvent.anchorProperty && gcalEvent.anchorProperty !== propertyOfInterest) {
    return {
      code: "wrong-property",
      payload: { anchor_property: gcalEvent.anchorProperty },
    };
  }

  const clusters = clusterBookings(bookings);
  if (clusters.length === 0) {
    // First-booker — anything inside window is fine
    return null;
  }

  const ownCluster    = clusters.find((c) => c.property === propertyOfInterest) || null;
  const otherClusters = clusters.filter((c) => c.property !== propertyOfInterest);

  // Same-property prospect: skip travel-buffer (they own the cluster) and
  // jump straight to the would-block-existing check. Carl scenario.
  if (ownCluster) {
    const newLatest   = Math.max(ownCluster.latestMs,   slotEndMs);
    const newEarliest = Math.min(ownCluster.earliestMs, slotStartMs);
    for (const other of otherClusters) {
      if (other.earliestMs >= newLatest && other.earliestMs - newLatest < TRAVEL_BUFFER_MS) {
        return { code: "would-block-existing", payload: {} };
      }
      if (newEarliest >= other.latestMs && newEarliest - other.latestMs < TRAVEL_BUFFER_MS) {
        return { code: "would-block-existing", payload: {} };
      }
    }
    return null;
  }

  // Cross-property prospect: buffer check against every existing cluster.
  for (const c of otherClusters) {
    if (slotEndMs <= c.earliestMs && c.earliestMs - slotEndMs < TRAVEL_BUFFER_MS) {
      const isEdge = slotStartMs === window.startMs;
      if (!isEdge) {
        return {
          code: "travel-buffer",
          payload: { earliest_allowed: new Date(c.latestMs + TRAVEL_BUFFER_MS).toISOString() },
        };
      }
    }
    if (slotStartMs >= c.latestMs && slotStartMs - c.latestMs < TRAVEL_BUFFER_MS) {
      const isEdge = slotEndMs === window.endMs;
      if (!isEdge) {
        return {
          code: "travel-buffer",
          payload: { earliest_allowed: new Date(c.latestMs + TRAVEL_BUFFER_MS).toISOString() },
        };
      }
    }
  }

  return null;
}

// Export internals for testing
export const _internal = {
  SLOT_MS,
  TRAVEL_BUFFER_MS,
  TZ_OFFSET_MS,
  WINDOW_DEFS,
  clusterBookings,
};
