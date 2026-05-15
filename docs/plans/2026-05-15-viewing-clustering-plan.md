# Viewing Clustering — Implementation Plan
*Companion to `docs/specs/2026-05-15-viewing-clustering.md` · 2026-05-15*

## Plan structure
Tasks are ordered by dependency. Each task has: file paths, what to do, exact code skeleton, test cases, and a single atomic commit. Run `npm run lint` and any relevant tests before each commit. Every commit gets pushed to Vercel (per house rule).

Subagent dispatch grouping (for `superpowers:subagent-driven-development`):
- **Wave 1 (sequential, no deps):** Task 1 (migration), Task 2 (resolver pure-fn lib).
- **Wave 2 (parallel, depend on Wave 1):** Task 3 (GCal helper), Task 4 (cluster API endpoint), Task 5 (off-horizon endpoint).
- **Wave 3 (parallel, depend on Wave 2):** Task 6 (booking create — server validation), Task 7 (frontend booking flow refactor), Task 8 (cron extension), Task 9 (viewing-notify off-horizon template).
- **Wave 4 (sequential, end):** Task 10 (admin Kanban hooks), Task 11 (env handling + cleanup), Task 12 (final synthetic E2E + Vercel preview verify).

---

## Task 1 — Add `viewing_rules_version` migration

**Files:**
- `supabase/migrations/20260515000000_viewing_clustering_v1.sql` (new)

**What to do:**
1. Add column `viewing_rules_version TEXT NOT NULL DEFAULT 'v0'` to `property_viewings`.
2. Backfill existing rows to `'v0'`.
3. Add `get_viewing_windows()` SQL function.
4. Add partial index for off-horizon leads.

**Skeleton:**
```sql
-- supabase/migrations/20260515000000_viewing_clustering_v1.sql
-- Spec: docs/specs/2026-05-15-viewing-clustering.md

-- 1. property_viewings: add rules_version
ALTER TABLE property_viewings
  ADD COLUMN IF NOT EXISTS viewing_rules_version TEXT NOT NULL DEFAULT 'v0';

-- (existing rows pick up the default 'v0' automatically; no backfill needed)

-- 2. helper function: get_viewing_windows(_horizon_days int)
CREATE OR REPLACE FUNCTION public.get_viewing_windows(_horizon_days int DEFAULT 7)
RETURNS TABLE (
  window_key text,
  window_start timestamptz,
  window_end   timestamptz,
  day_of_week  text
) LANGUAGE sql STABLE AS $$
  WITH days AS (
    SELECT generate_series(
      (date_trunc('day', now() AT TIME ZONE 'Asia/Singapore'))::date,
      ((date_trunc('day', now() AT TIME ZONE 'Asia/Singapore'))::date + (_horizon_days - 1)),
      interval '1 day'
    )::date AS d
  )
  SELECT
    CASE EXTRACT(DOW FROM d)::int
      WHEN 5 THEN 'fri-evening'
      WHEN 6 THEN 'sat-morning'
      WHEN 0 THEN 'sun-afternoon'
    END AS window_key,
    ((d::timestamp + (CASE EXTRACT(DOW FROM d)::int
                       WHEN 5 THEN interval '19 hours'
                       WHEN 6 THEN interval '10 hours'
                       WHEN 0 THEN interval '16 hours' END))
       AT TIME ZONE 'Asia/Singapore') AS window_start,
    ((d::timestamp + (CASE EXTRACT(DOW FROM d)::int
                       WHEN 5 THEN interval '22 hours'
                       WHEN 6 THEN interval '13 hours'
                       WHEN 0 THEN interval '18 hours' END))
       AT TIME ZONE 'Asia/Singapore') AS window_end,
    to_char(d, 'Day') AS day_of_week
  FROM days
  WHERE EXTRACT(DOW FROM d)::int IN (0, 5, 6);
$$;

-- 3. Index for off-horizon leads (b-tree on jsonb expression)
CREATE INDEX IF NOT EXISTS leads_off_horizon_idx
  ON leads ((intent->>'off_horizon'))
  WHERE (intent->>'off_horizon') = 'true';
```

**Tests:**
- Apply via `mcp__supabase__create_branch` first → `apply_migration` → query `SELECT viewing_rules_version FROM property_viewings LIMIT 1` returns `'v0'`.
- Query `SELECT * FROM get_viewing_windows(7)` returns rows for upcoming Fri/Sat/Sun.

**Commit:**
```
feat(db): viewing-clustering v1 migration — rules_version + windows fn + leads index
```

---

## Task 2 — Pure-function clustering resolver lib

**Files:**
- `src/lib/viewingClustering.js` (new)
- `src/lib/viewingClustering.test.js` (new — node test runner format, no test deps required)

**What to do:**
Implement the slot resolver from spec §2.1. Pure JS, no DB, no React. Used by both API route (server) and unit tests.

**Skeleton:**
```js
// src/lib/viewingClustering.js
// Slot resolver for V3 booking. Pure function.
//
// Inputs:
//   - propertyOfInterest: 'CP' | 'IH' | 'TG'
//   - windowsFromGcal: [{ start, end, anchorProperty }] from listBookingWindowEvents
//   - bookings: [{ slot_start, slot_end, property_code, status }]
//   - now: Date (for horizon filtering)
//   - horizonDays: int (default 7)
//
// Output:
//   { windows: [{ key, date, window_start, window_end, state, anchor_property,
//                  free_slot_count, slots: [{start, end, state}] }] }

const SLOT_MS = 15 * 60 * 1000;
const TRAVEL_BUFFER_MS = 30 * 60 * 1000;
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // SGT

const WINDOW_DEFS = [
  { dow: 5, key: 'fri-evening', startH: 19, endH: 22 },  // Friday
  { dow: 6, key: 'sat-morning', startH: 10, endH: 13 },  // Saturday
  { dow: 0, key: 'sun-afternoon', startH: 16, endH: 18 },// Sunday
];

export const SLOT_STATE = {
  OPEN_ANY: 'OPEN-ANY',
  PROP_RESERVED: 'PROP-RESERVED',
  BLOCKED_BUFFER: 'BLOCKED-BUFFER',
  BOOKED: 'BOOKED',
  WINDOW_CLOSED: 'WINDOW-CLOSED',
  OUT_OF_HORIZON: 'OUT-OF-HORIZON',
};

export const WINDOW_STATE = {
  CLOSED: 'CLOSED',          // no GCal event
  OPEN_ANY: 'OPEN-ANY',      // GCal event present, no anchor yet
  OPEN_PROP: 'OPEN-PROP',    // anchor set (either GCal pre-anchor or first-booker)
};

export function listUpcomingWindows(now, horizonDays = 7) {
  // Returns: [{ key, dateIso, startMs, endMs }]
  const out = [];
  const sgtNow = new Date(now.getTime() + TZ_OFFSET_MS);
  const startOfTodaySgt = Date.UTC(
    sgtNow.getUTCFullYear(),
    sgtNow.getUTCMonth(),
    sgtNow.getUTCDate(),
    0, 0, 0
  ) - TZ_OFFSET_MS;

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const dayStartUtcMs = startOfTodaySgt + dayOffset * 24 * 60 * 60 * 1000;
    const dayDow = new Date(dayStartUtcMs + TZ_OFFSET_MS).getUTCDay();
    const def = WINDOW_DEFS.find(w => w.dow === dayDow);
    if (!def) continue;
    const startMs = dayStartUtcMs + def.startH * 60 * 60 * 1000;
    const endMs   = dayStartUtcMs + def.endH * 60 * 60 * 1000;
    if (endMs <= now.getTime()) continue; // already past
    const dateIso = new Date(dayStartUtcMs + TZ_OFFSET_MS).toISOString().slice(0, 10);
    out.push({ key: def.key, dateIso, startMs, endMs });
  }
  return out;
}

function findGcalEventForWindow(window, gcalEvents) {
  // Match: GCal event whose start equals window.startMs (within ±5 min tolerance for human imprecision)
  const tolerance = 5 * 60 * 1000;
  return gcalEvents.find(ev => {
    const evStartMs = new Date(ev.start).getTime();
    return Math.abs(evStartMs - window.startMs) <= tolerance;
  }) || null;
}

function clusterBookings(bookings) {
  // Group adjacent same-property bookings into clusters.
  // Returns: [{ property, earliestMs, latestMs, slots: [{startMs, endMs}] }]
  const sorted = [...bookings].sort((a, b) => new Date(a.slot_start) - new Date(b.slot_start));
  const clusters = [];
  for (const b of sorted) {
    const startMs = new Date(b.slot_start).getTime();
    const endMs = new Date(b.slot_end).getTime();
    const existing = clusters.find(c => c.property === b.property_code);
    if (existing) {
      existing.earliestMs = Math.min(existing.earliestMs, startMs);
      existing.latestMs = Math.max(existing.latestMs, endMs);
      existing.slots.push({ startMs, endMs });
    } else {
      clusters.push({
        property: b.property_code,
        earliestMs: startMs,
        latestMs: endMs,
        slots: [{ startMs, endMs }],
      });
    }
  }
  return clusters;
}

function isSlotBooked(slotStartMs, bookings) {
  return bookings.some(b => new Date(b.slot_start).getTime() === slotStartMs);
}

function isWindowEdge(slotStartMs, slotEndMs, window) {
  return slotStartMs === window.startMs || slotEndMs === window.endMs;
}

export function resolveSlots({
  propertyOfInterest,
  window,
  gcalEvent,           // null = closed
  bookings,            // bookings inside this window only
}) {
  if (!gcalEvent) {
    // Window closed
    return {
      state: WINDOW_STATE.CLOSED,
      anchorProperty: null,
      slots: [],  // empty when closed (UI shows greyed badge, no slot grid)
    };
  }

  // Anchor: GCal pre-anchor wins, else first booking's property, else null
  let anchor = gcalEvent.anchorProperty || null;
  if (!anchor && bookings.length > 0) {
    const firstBooking = [...bookings].sort(
      (a, b) => new Date(a.slot_start) - new Date(b.slot_start)
    )[0];
    anchor = firstBooking.property_code;
  }

  const clusters = clusterBookings(bookings);

  const slots = [];
  for (let cursor = window.startMs; cursor + SLOT_MS <= window.endMs; cursor += SLOT_MS) {
    const slotStartMs = cursor;
    const slotEndMs = cursor + SLOT_MS;
    const startIso = new Date(slotStartMs).toISOString();
    const endIso = new Date(slotEndMs).toISOString();

    // BOOKED check first
    if (isSlotBooked(slotStartMs, bookings)) {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.BOOKED });
      continue;
    }

    // No anchor, window open → OPEN-ANY
    if (!anchor) {
      slots.push({ start: startIso, end: endIso, state: SLOT_STATE.OPEN_ANY });
      continue;
    }

    // Anchor exists. Check buffer rules.
    const ownCluster = clusters.find(c => c.property === propertyOfInterest);
    const otherClusters = clusters.filter(c => c.property !== propertyOfInterest);
    const isEdge = isWindowEdge(slotStartMs, slotEndMs, window);

    // Same-property: PROP-RESERVED everywhere except where it would block downstream
    if (anchor === propertyOfInterest) {
      const wouldBlockDownstream = otherClusters.some(other => {
        // If we extend our cluster to include this slot, would the new latestMs
        // push the cross-property buffer past the other cluster's earliestMs?
        const newLatest = ownCluster
          ? Math.max(ownCluster.latestMs, slotEndMs)
          : slotEndMs;
        const newEarliest = ownCluster
          ? Math.min(ownCluster.earliestMs, slotStartMs)
          : slotStartMs;
        // Buffer violation in either direction
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

    // Cross-property prospect. Check buffer against all clusters.
    let blockedByBuffer = false;
    let withinAnchorClusterRange = false;
    for (const c of clusters) {
      // Within cluster range = PROP_RESERVED for them, not us
      if (slotStartMs >= c.earliestMs && slotEndMs <= c.latestMs) {
        withinAnchorClusterRange = true;
        break;
      }
      // Buffer check
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

/**
 * Top-level helper: given everything, return the full window list with states.
 */
export function buildWindowsResponse({
  propertyOfInterest,
  now,
  gcalEvents,
  allBookings,    // all confirmed/pending bookings in the next horizon
  horizonDays = 7,
}) {
  const upcomingWindows = listUpcomingWindows(now, horizonDays);
  return upcomingWindows.map(w => {
    const gcalEvent = findGcalEventForWindow(w, gcalEvents);
    const windowBookings = allBookings.filter(b => {
      const ms = new Date(b.slot_start).getTime();
      return ms >= w.startMs && ms < w.endMs;
    });
    const resolution = resolveSlots({
      propertyOfInterest,
      window: w,
      gcalEvent,
      bookings: windowBookings,
    });
    const freeSlotCount = resolution.slots.filter(s =>
      s.state === SLOT_STATE.OPEN_ANY ||
      (s.state === SLOT_STATE.PROP_RESERVED && resolution.anchorProperty === propertyOfInterest)
    ).length;
    return {
      key: w.key,
      date: w.dateIso,
      window_start: new Date(w.startMs).toISOString(),
      window_end: new Date(w.endMs).toISOString(),
      state: resolution.state,
      anchor_property: resolution.anchorProperty,
      free_slot_count: freeSlotCount,
      slots: resolution.slots,
    };
  });
}

/**
 * Server-side validator for booking creation. Returns null if valid, or
 * { code, payload } if rejected.
 */
export function validateBookingAttempt({
  propertyOfInterest,
  slotStartIso,
  window,
  gcalEvent,
  bookings,        // existing bookings in the window
}) {
  if (!gcalEvent) return { code: 'window-closed', payload: {} };

  const slotStartMs = new Date(slotStartIso).getTime();
  const slotEndMs = slotStartMs + SLOT_MS;

  if (slotStartMs < window.startMs || slotEndMs > window.endMs) {
    return { code: 'slot-outside-window', payload: {} };
  }

  // Check exact slot already booked
  if (bookings.some(b => new Date(b.slot_start).getTime() === slotStartMs)) {
    return { code: 'slot-taken', payload: {} };
  }

  // GCal pre-anchor wins
  if (gcalEvent.anchorProperty && gcalEvent.anchorProperty !== propertyOfInterest) {
    return {
      code: 'wrong-property',
      payload: { anchor_property: gcalEvent.anchorProperty },
    };
  }

  const clusters = clusterBookings(bookings);
  const otherClusters = clusters.filter(c => c.property !== propertyOfInterest);

  // First-booker anchor: if no clusters, anything goes
  if (clusters.length === 0) return null;

  // Cross-property buffer
  for (const c of otherClusters) {
    if (slotEndMs <= c.earliestMs && c.earliestMs - slotEndMs < TRAVEL_BUFFER_MS) {
      const isEdge = slotStartMs === window.startMs;
      if (!isEdge) {
        return {
          code: 'travel-buffer',
          payload: { earliest_allowed: new Date(c.latestMs + TRAVEL_BUFFER_MS).toISOString() },
        };
      }
    }
    if (slotStartMs >= c.latestMs && slotStartMs - c.latestMs < TRAVEL_BUFFER_MS) {
      const isEdge = slotEndMs === window.endMs;
      if (!isEdge) {
        return {
          code: 'travel-buffer',
          payload: { earliest_allowed: new Date(c.latestMs + TRAVEL_BUFFER_MS).toISOString() },
        };
      }
    }
  }

  // Anchor mismatch (first-booker auto-anchor)
  const ownCluster = clusters.find(c => c.property === propertyOfInterest);
  if (!ownCluster && otherClusters.length > 0) {
    // Cross-property allowed only if outside any other cluster's buffer
    // (already checked above). OK.
  }

  // Same-property extension blocking downstream
  if (ownCluster) {
    const newLatest = Math.max(ownCluster.latestMs, slotEndMs);
    const newEarliest = Math.min(ownCluster.earliestMs, slotStartMs);
    for (const other of otherClusters) {
      if (other.earliestMs >= newLatest && other.earliestMs - newLatest < TRAVEL_BUFFER_MS) {
        return { code: 'would-block-existing', payload: {} };
      }
      if (newEarliest >= other.latestMs && newEarliest - other.latestMs < TRAVEL_BUFFER_MS) {
        return { code: 'would-block-existing', payload: {} };
      }
    }
  }

  return null;
}
```

**Tests** (`src/lib/viewingClustering.test.js`):
```js
// Run with: node --test src/lib/viewingClustering.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSlots,
  validateBookingAttempt,
  listUpcomingWindows,
  WINDOW_STATE,
  SLOT_STATE,
} from './viewingClustering.js';

// Helper: build a Friday 19:00-22:00 SGT window for a known date
function friWindow(dateStr = '2026-05-15') {
  const startMs = new Date(`${dateStr}T19:00:00+08:00`).getTime();
  const endMs   = new Date(`${dateStr}T22:00:00+08:00`).getTime();
  return { key: 'fri-evening', dateIso: dateStr, startMs, endMs };
}
const openGcal = { start: '2026-05-15T19:00:00+08:00', end: '2026-05-15T22:00:00+08:00', anchorProperty: null };
const openGcalAnchorTG = { ...openGcal, anchorProperty: 'TG' };

test('closed window returns no slots', () => {
  const r = resolveSlots({ propertyOfInterest: 'TG', window: friWindow(), gcalEvent: null, bookings: [] });
  assert.equal(r.state, WINDOW_STATE.CLOSED);
  assert.equal(r.slots.length, 0);
});

test('open window, no bookings → all 12 slots OPEN-ANY', () => {
  const r = resolveSlots({ propertyOfInterest: 'TG', window: friWindow(), gcalEvent: openGcal, bookings: [] });
  assert.equal(r.state, WINDOW_STATE.OPEN_ANY);
  assert.equal(r.slots.length, 12);
  assert.ok(r.slots.every(s => s.state === SLOT_STATE.OPEN_ANY));
});

test('TG booked at 19:45, TG prospect sees PROP-RESERVED + BOOKED', () => {
  const bookings = [{
    slot_start: '2026-05-15T19:45:00+08:00',
    slot_end:   '2026-05-15T20:00:00+08:00',
    property_code: 'TG', status: 'confirmed',
  }];
  const r = resolveSlots({ propertyOfInterest: 'TG', window: friWindow(), gcalEvent: openGcal, bookings });
  const at1945 = r.slots.find(s => s.start === '2026-05-15T11:45:00.000Z'); // SGT 19:45 == UTC 11:45
  assert.equal(at1945.state, SLOT_STATE.BOOKED);
  assert.equal(r.anchorProperty, 'TG');
  // 19:00 (window edge) for TG
  const at1900 = r.slots.find(s => s.start === '2026-05-15T11:00:00.000Z');
  assert.equal(at1900.state, SLOT_STATE.PROP_RESERVED);
});

test('TG booked at 19:45, CP prospect sees BLOCKED-BUFFER around it, OPEN-ANY at edges', () => {
  const bookings = [{
    slot_start: '2026-05-15T19:45:00+08:00',
    slot_end:   '2026-05-15T20:00:00+08:00',
    property_code: 'TG', status: 'confirmed',
  }];
  const r = resolveSlots({ propertyOfInterest: 'CP', window: friWindow(), gcalEvent: openGcal, bookings });
  // 19:00 = window edge → OPEN-ANY (exception)
  const at1900 = r.slots.find(s => s.start === '2026-05-15T11:00:00.000Z');
  assert.equal(at1900.state, SLOT_STATE.OPEN_ANY);
  // 19:30 = within 30 min before TG start → BLOCKED-BUFFER
  const at1930 = r.slots.find(s => s.start === '2026-05-15T11:30:00.000Z');
  assert.equal(at1930.state, SLOT_STATE.BLOCKED_BUFFER);
  // 20:30 = exactly 30 min after TG ends → OPEN-ANY
  const at2030 = r.slots.find(s => s.start === '2026-05-15T12:30:00.000Z');
  assert.equal(at2030.state, SLOT_STATE.OPEN_ANY);
});

test('GCal pre-anchored TG only — CP prospect rejected at validate', () => {
  const result = validateBookingAttempt({
    propertyOfInterest: 'CP',
    slotStartIso: '2026-05-15T19:00:00+08:00',
    window: friWindow(),
    gcalEvent: openGcalAnchorTG,
    bookings: [],
  });
  assert.equal(result.code, 'wrong-property');
  assert.equal(result.payload.anchor_property, 'TG');
});

test('Carl scenario: TG extension would invalidate booked CP slot', () => {
  // Setup: Alice TG 19:45, Bob CP 20:30 already booked. Carl tries TG 20:15.
  const bookings = [
    { slot_start: '2026-05-15T19:45:00+08:00', slot_end: '2026-05-15T20:00:00+08:00', property_code: 'TG', status: 'confirmed' },
    { slot_start: '2026-05-15T20:30:00+08:00', slot_end: '2026-05-15T20:45:00+08:00', property_code: 'CP', status: 'confirmed' },
  ];
  const result = validateBookingAttempt({
    propertyOfInterest: 'TG',
    slotStartIso: '2026-05-15T20:15:00+08:00',
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.equal(result.code, 'would-block-existing');
});

test('Cross-property travel buffer: CP at 20:00 after TG ends 20:00 is rejected', () => {
  const bookings = [{
    slot_start: '2026-05-15T19:45:00+08:00',
    slot_end:   '2026-05-15T20:00:00+08:00',
    property_code: 'TG', status: 'confirmed',
  }];
  const result = validateBookingAttempt({
    propertyOfInterest: 'CP',
    slotStartIso: '2026-05-15T20:00:00+08:00',
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.equal(result.code, 'travel-buffer');
});

test('Cross-property at 20:30 after TG ends 20:00 — accepted', () => {
  const bookings = [{
    slot_start: '2026-05-15T19:45:00+08:00',
    slot_end:   '2026-05-15T20:00:00+08:00',
    property_code: 'TG', status: 'confirmed',
  }];
  const result = validateBookingAttempt({
    propertyOfInterest: 'CP',
    slotStartIso: '2026-05-15T20:30:00+08:00',
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.equal(result, null);
});

test('listUpcomingWindows returns only Fri/Sat/Sun within horizon', () => {
  // 2026-05-14 is Thursday — first window should be Fri 15
  const now = new Date('2026-05-14T12:00:00+08:00');
  const ws = listUpcomingWindows(now, 7);
  assert.ok(ws.length >= 3); // Fri, Sat, Sun in the next 7 days
  assert.equal(ws[0].key, 'fri-evening');
});
```

**Commit:**
```
feat(lib): viewing clustering resolver + validator + tests
```

---

## Task 3 — GCal helper: list booking-window events

**Files:**
- `src/lib/googleCalendar.js` (modify)

**What to do:**
Add `listBookingWindowEvents(startIso, endIso)`. Reuse existing OAuth client.

**Skeleton patch:**
```js
// Append to src/lib/googleCalendar.js
// (Plus: rename env to support LAZYBEE_VIEWINGS_CAL_ID with fallback to HYVE_)

function getCalendarId() {
  return process.env.LAZYBEE_VIEWINGS_CAL_ID
      || process.env.HYVE_VIEWINGS_CAL_ID
      || env('LAZYBEE_VIEWINGS_CAL_ID');
}

const BOOKING_WINDOW_RE = /^booking window( — (CP|IH|TG) only)?$/i;

export async function listBookingWindowEvents(startIso, endIso) {
  const cal = getCalendarClient();
  const calendarId = getCalendarId();
  const r = await cal.events.list({
    calendarId,
    timeMin: startIso,
    timeMax: endIso,
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: TZ,
    q: 'booking window',
    maxResults: 50,
  });
  const items = r.data.items || [];
  return items
    .filter(ev => BOOKING_WINDOW_RE.test(String(ev.summary || '').trim()))
    .map(ev => {
      const m = String(ev.summary || '').match(/—\s*(CP|IH|TG)\s*only/i);
      return {
        start: ev.start?.dateTime || ev.start?.date,
        end:   ev.end?.dateTime   || ev.end?.date,
        summary: ev.summary,
        anchorProperty: m ? m[1].toUpperCase() : null,
      };
    });
}
```

**Tests:** Manual via the `/api/booking/windows` endpoint after Task 4. No unit test (hits live GCal).

**Commit:**
```
feat(gcal): listBookingWindowEvents — list and parse anchor events
```

---

## Task 4 — `GET /api/booking/windows` endpoint

**Files:**
- `api/booking/[...path].js` (modify — add new route handler `handleWindows`, register in dispatcher switch)

**What to do:**
1. Add `handleWindows(req, res)` per spec §5.1.
2. Register in switch: `case "windows": return await handleWindows(req, res);`

**Skeleton:**
```js
// At top, alongside existing imports:
import { listBookingWindowEvents } from "../../src/lib/googleCalendar.js";
import { buildWindowsResponse } from "../../src/lib/viewingClustering.js";

async function handleWindows(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const property = normalizePropertyCode(req.query?.property);
  if (!property) return res.status(400).json({ error: "property required" });
  if (!['CP', 'IH', 'TG'].includes(property)) {
    return res.status(400).json({ error: `unknown property '${property}'` });
  }

  const horizonDays = 7;
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  // Fetch GCal control-plane events
  let gcalEvents = [];
  try {
    gcalEvents = await listBookingWindowEvents(now.toISOString(), horizonEnd.toISOString());
  } catch (err) {
    console.error("[booking/windows] gcal failed:", err);
    return res.status(503).json({ error: "calendar service unavailable" });
  }

  // Fetch existing bookings in horizon, joined to property code
  const { data: bookings, error: bookErr } = await supabase
    .from("property_viewings")
    .select("slot_start, slot_end, status, properties(code)")
    .in("status", ["pending", "confirmed"])
    .gte("slot_start", now.toISOString())
    .lte("slot_start", horizonEnd.toISOString());
  if (bookErr) {
    console.error("[booking/windows] bookings fetch failed:", bookErr);
    return res.status(500).json({ error: "bookings lookup failed" });
  }

  const bookingsForResolver = (bookings || [])
    .filter(b => b.properties?.code)
    .map(b => ({
      slot_start: b.slot_start,
      slot_end: b.slot_end,
      property_code: b.properties.code,
      status: b.status,
    }));

  const windows = buildWindowsResponse({
    propertyOfInterest: property,
    now,
    gcalEvents,
    allBookings: bookingsForResolver,
    horizonDays,
  });

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    windows,
    horizon_days: horizonDays,
    rules_version: "v1",
    computed_at: new Date().toISOString(),
  });
}

// In the dispatcher switch, add:
//   case "windows":
//     return await handleWindows(req, res);
```

**Tests:** Manual via curl after deploy.

**Commit:**
```
feat(api): GET /api/booking/windows — clustered slot availability
```

---

## Task 5 — `POST /api/booking/leads/off-horizon` endpoint

**Files:**
- `api/booking/[...path].js` (modify)

**What to do:**
Add new route handler `handleOffHorizonLead`.

**Skeleton:**
```js
async function handleOffHorizonLead(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase() || null;
  const phone = normalizePhone(body.phone);
  const propertyCode = normalizePropertyCode(body.property);
  const roomCode = body.room_code ? String(body.room_code).trim() : null;
  const targetMoveInDate = body.target_move_in_date;
  const source = normalizeSource(body.source);

  if (!name || name.length < 2) return res.status(400).json({ error: "name required" });
  if (!email && !phone) return res.status(400).json({ error: "email or phone required" });
  if (!propertyCode || !['CP', 'IH', 'TG'].includes(propertyCode)) {
    return res.status(400).json({ error: "valid property required" });
  }
  if (!targetMoveInDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetMoveInDate)) {
    return res.status(400).json({ error: "target_move_in_date required (YYYY-MM-DD)" });
  }

  const moveInMs = Date.parse(`${targetMoveInDate}T00:00:00+08:00`);
  const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (moveInMs < sevenDaysFromNow) {
    return res.status(400).json({
      error: "target_move_in_date must be more than 7 days from now — use the main booking flow",
    });
  }

  const reminderDueMs = moveInMs - 10 * 24 * 60 * 60 * 1000;
  const reminderDueAt = new Date(reminderDueMs).toISOString();

  const intent = {
    off_horizon: true,
    target_move_in_date: targetMoveInDate,
    reminder_due_at: reminderDueAt,
    reminder_channel: ['whatsapp', 'email'],
    reminder_sent_count: 0,
    reminder_last_sent_at: null,
    preferred_property: propertyCode,
    preferred_room_code: roomCode,
  };

  const activityEntry = {
    type: 'off_horizon_captured',
    actor: 'system',
    when: new Date().toISOString(),
    payload: { target_move_in_date: targetMoveInDate, property: propertyCode },
  };

  // Try to upsert by email/phone — same dedup pattern as handleCreate
  let existingLead = null;
  if (email) {
    const { data } = await supabase
      .from("leads")
      .select("id, intent, activity_log, property_interest")
      .eq("email", email).maybeSingle();
    existingLead = data;
  }
  if (!existingLead && phone) {
    const { data } = await supabase
      .from("leads")
      .select("id, intent, activity_log, property_interest")
      .eq("phone", phone).maybeSingle();
    existingLead = data;
  }

  let leadId;
  if (existingLead) {
    const mergedInterest = Array.from(new Set([
      ...(existingLead.property_interest || []),
      propertyCode,
    ]));
    const mergedIntent = { ...(existingLead.intent || {}), ...intent };
    const mergedLog = [...(existingLead.activity_log || []), activityEntry];
    const { error } = await supabase
      .from("leads")
      .update({
        name,
        email: email || null,
        phone: phone || null,
        property_interest: mergedInterest,
        intent: mergedIntent,
        activity_log: mergedLog,
        source,
        status: existingLead.status === 'cold' ? 'new' : (existingLead.status || 'new'),
      })
      .eq("id", existingLead.id);
    if (error) {
      console.error("[booking/leads/off-horizon] update error:", error);
      return res.status(500).json({ error: "Failed to save lead" });
    }
    leadId = existingLead.id;
  } else {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name,
        email,
        phone,
        property_interest: [propertyCode],
        source,
        status: 'new',
        intent,
        activity_log: [activityEntry],
      })
      .select("id").single();
    if (error || !data) {
      console.error("[booking/leads/off-horizon] insert error:", error);
      return res.status(500).json({ error: "Failed to save lead" });
    }
    leadId = data.id;
  }

  return res.status(200).json({ success: true, lead_id: leadId });
}

// Register: case "leads/off-horizon": return await handleOffHorizonLead(req, res);
```

**Tests:** Manual via curl after deploy.

**Commit:**
```
feat(api): POST /api/booking/leads/off-horizon — capture future move-ins
```

---

## Task 6 — Server-side validation in `POST /api/booking/create`

**Files:**
- `api/booking/[...path].js` (modify `handleCreate`)

**What to do:**
After existing slot/race-guard checks, add cluster-rule validation when the prospect submits via the V3 form (we know via the body field `rules_version`, default `'v1'`).

**Skeleton patch:**
```js
// Inside handleCreate, after race-guards, before insert:

const rulesVersion = body.rules_version === 'v0' ? 'v0' : 'v1';

if (rulesVersion === 'v1') {
  // Identify which window this slot falls into
  const slotStartMs = new Date(slotStart).getTime();
  const upcomingWindows = listUpcomingWindows(new Date(), 7);
  const window = upcomingWindows.find(w =>
    slotStartMs >= w.startMs && slotStartMs < w.endMs
  );
  if (!window) {
    return res.status(409).json({ error: "slot is not in any V3 viewing window" });
  }

  // Fetch GCal event for this window
  let gcalEvent = null;
  try {
    const events = await listBookingWindowEvents(
      new Date(window.startMs - 60_000).toISOString(),
      new Date(window.endMs + 60_000).toISOString(),
    );
    gcalEvent = events.find(e => Math.abs(new Date(e.start).getTime() - window.startMs) <= 5 * 60_000) || null;
  } catch (err) {
    console.error("[booking/create] gcal lookup failed:", err);
    return res.status(503).json({ error: "calendar service unavailable" });
  }

  // Fetch all bookings in this window
  const { data: windowBookings, error: wbErr } = await supabase
    .from("property_viewings")
    .select("slot_start, slot_end, status, properties(code)")
    .in("status", ["pending", "confirmed"])
    .gte("slot_start", new Date(window.startMs).toISOString())
    .lt("slot_start", new Date(window.endMs).toISOString());
  if (wbErr) return res.status(500).json({ error: "window bookings lookup failed" });

  const bookingsForValidator = (windowBookings || [])
    .filter(b => b.properties?.code)
    .map(b => ({
      slot_start: b.slot_start,
      slot_end: b.slot_end,
      property_code: b.properties.code,
      status: b.status,
    }));

  const result = validateBookingAttempt({
    propertyOfInterest: propertyCode,
    slotStartIso: slotStart,
    window,
    gcalEvent,
    bookings: bookingsForValidator,
  });
  if (result) {
    return res.status(409).json({
      error: result.code,
      ...result.payload,
    });
  }
}

// Then in the insert payload, add:
viewing_rules_version: rulesVersion,
```

Don't forget the imports at the top:
```js
import {
  listUpcomingWindows,
  validateBookingAttempt,
} from "../../src/lib/viewingClustering.js";
```

**Tests:**
- Manual: curl `/api/booking/create` with a slot in a closed window → expect 409 `window-closed`.
- Carl scenario via curl after seeding 2 bookings → 409 `would-block-existing`.

**Commit:**
```
feat(api): server-side cluster-rule validation in /api/booking/create
```

---

## Task 7 — Frontend booking flow refactor

**Files:**
- `src/pages/book/_clusteringMeta.js` (new — labels)
- `src/pages/book/BookingFlow.jsx` (modify heavily)
- `src/pages/book/_bookApi.js` (add `fetchWindows`, `submitOffHorizonLead`)

**What to do:**
1. New `_clusteringMeta.js`: window labels, slot state → human copy.
2. `_bookApi.js`: add `fetchWindows({property})` and `submitOffHorizonLead(payload)`.
3. `BookingFlow.jsx`: replace 14-day picker with windows list. Render slot grid only for clickable windows. Add off-horizon mini-form below.

**Skeleton — `_clusteringMeta.js`:**
```js
export const WINDOW_LABELS = {
  'fri-evening':   'Friday evening',
  'sat-morning':   'Saturday morning',
  'sun-afternoon': 'Sunday afternoon',
};

export const WINDOW_TIMES = {
  'fri-evening':   '7–10 pm',
  'sat-morning':   '10 am – 1 pm',
  'sun-afternoon': '4–6 pm',
};

export function describeWindowState(window, propertyOfInterest) {
  if (window.state === 'CLOSED') return { label: 'Closed this week', clickable: false };
  if (window.state === 'OPEN-PROP' && window.anchor_property !== propertyOfInterest) {
    return { label: `Booked for ${window.anchor_property} this week`, clickable: false };
  }
  if (window.free_slot_count === 0) {
    return { label: 'Fully booked', clickable: false };
  }
  return { label: `${window.free_slot_count} slot${window.free_slot_count === 1 ? '' : 's'} open`, clickable: true };
}

export function isSlotClickable(slot, propertyOfInterest, anchorProperty) {
  if (slot.state === 'BOOKED') return false;
  if (slot.state === 'WINDOW-CLOSED') return false;
  if (slot.state === 'BLOCKED-BUFFER') return false;
  if (slot.state === 'PROP-RESERVED') return anchorProperty === propertyOfInterest;
  return slot.state === 'OPEN-ANY';
}
```

**Skeleton — `_bookApi.js` additions:**
```js
export function fetchWindows({ property, signal } = {}) {
  return jsonFetch(`/api/booking/windows?property=${encodeURIComponent(property)}`, { signal });
}

export function submitOffHorizonLead(payload) {
  return jsonFetch('/api/booking/leads/off-horizon', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

**Skeleton — `BookingFlow.jsx` changes:**
- Replace `getNextDays(14)` and date picker with `useEffect` calling `fetchWindows`.
- Render windows as cards in a column on mobile, 3-up grid on `lg:` and wider, with `xl:` and `2xl:` extra spacing per wide-screen rule.
- Each window card: header (date + label + time range), then slot pills for clickable windows.
- Submit form per existing flow but pass `rules_version: 'v1'` in `createBooking`.
- Below windows list: off-horizon mini-form with name/email/phone/move-in date.
- On submit success of either path, show the booking link.

(Full code skeleton in execution phase — too long to paste in plan.)

**Commit:**
```
feat(book): V3 windows UI + off-horizon capture mini-form
```

---

## Task 8 — Cron extension for off-horizon reminders

**Files:**
- `api/booking/[...path].js` (modify `handleCron`)

**What to do:**
Before existing 24h sweep, add off-horizon sweep per spec §4.3.

**Skeleton patch:**
```js
async function handleCron(req, res) {
  if (!authorizedCron(req)) return res.status(403).json({ error: "Forbidden" });
  const now = Date.now();

  // ── (NEW) off-horizon reminder sweep ─────────────────────────────
  const offHorizonSweep = { count: 0, results: [] };
  const { data: dueLeads, error: dueErr } = await supabase
    .from("leads")
    .select("id, name, email, phone, intent, activity_log, status")
    .in("status", ["new", "qualified"])
    .filter("intent->>off_horizon", "eq", "true")
    .filter("intent->>reminder_due_at", "lte", new Date(now).toISOString());

  if (dueErr) {
    console.error("[booking/cron] off-horizon sweep error:", dueErr);
  } else {
    for (const lead of dueLeads || []) {
      const intent = lead.intent || {};
      const sentCount = parseInt(intent.reminder_sent_count || 0, 10);
      const lastSent = intent.reminder_last_sent_at;
      // Apply 7-day rate limit + lifetime cap
      if (sentCount >= 2) continue;
      if (lastSent && new Date(lastSent).getTime() > now - 7 * 24 * 60 * 60 * 1000) continue;

      // Fire viewing-notify with lead-off-horizon-reminder event
      await fetch(`${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/viewing-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.IOT_SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ event: "lead-off-horizon-reminder", lead_id: lead.id }),
      }).catch(err => console.error("[off-horizon notify failed]:", err.message));

      const newSentCount = sentCount + 1;
      const newIntent = {
        ...intent,
        reminder_sent_count: newSentCount,
        reminder_last_sent_at: new Date().toISOString(),
      };
      const newLog = [...(lead.activity_log || []), {
        type: 'reminder_fired',
        actor: 'cron',
        when: new Date().toISOString(),
        payload: { channel: 'whatsapp+email', count: newSentCount },
      }];
      const newStatus = newSentCount >= 2 ? 'cold' : lead.status;
      if (newSentCount >= 2) {
        newLog.push({
          type: 'auto_marked_cold',
          actor: 'cron',
          when: new Date().toISOString(),
        });
      }
      await supabase
        .from("leads")
        .update({ intent: newIntent, activity_log: newLog, status: newStatus })
        .eq("id", lead.id);

      offHorizonSweep.count += 1;
      offHorizonSweep.results.push({ id: lead.id, sent_count: newSentCount });
    }
  }

  // ── existing 24h sweep ──────────────────────────────────────────
  // (rest of existing handleCron untouched)
  ...

  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    off_horizon: offHorizonSweep,
    reminder_24h: r24,
    reminder_2h: r2,
  });
}
```

**Tests:**
- Seed a fake lead via SQL on Supabase branch with `intent.off_horizon=true, reminder_due_at=now-1h`. Hit cron endpoint. Verify viewing-notify called + lead updated.

**Commit:**
```
feat(cron): off-horizon lead reminder sweep
```

---

## Task 9 — viewing-notify off-horizon template

**Files:**
- `supabase/functions/viewing-notify/index.ts` (modify)

**What to do:**
1. Accept new event `lead-off-horizon-reminder`.
2. Add a `loadLead(lead_id)` helper.
3. Add a template `tplOffHorizonReminder` (email).
4. Call Beeper Local API for WhatsApp (best-effort; log failure but don't crash).

**Skeleton patch:**
```ts
const BEEPER_API_URL = Deno.env.get("BEEPER_API_URL") || "http://127.0.0.1:23373";
const BEEPER_API_TOKEN = Deno.env.get("BEEPER_API_TOKEN") || "";

async function loadLead(lead_id: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, email, phone, chat_id, intent, property_interest")
    .eq("id", lead_id)
    .single();
  if (error || !data) throw new Error("Lead not found");
  return data;
}

function tplOffHorizonReminder(lead: any) {
  const property = (lead.property_interest && lead.property_interest[0]) || 'Lazybee';
  const targetDate = lead.intent?.target_move_in_date || 'your move-in window';
  const html = shell({
    title: "Slots are open — ready to view?",
    bodyHtml: `
      <p style="font-size:16px;color:#121c2a;">Hi ${escapeHtml(lead.name || 'there')},</p>
      <p style="font-size:15px;color:#3c4947;">You mentioned a move-in around <strong>${escapeHtml(targetDate)}</strong>. We've got viewing slots open at <strong>${escapeHtml(property)}</strong> over the next two weekends.</p>
      <p style="font-size:15px;color:#3c4947;">Want to lock one in?</p>
      <p style="font-size:14px;color:#3c4947;margin-top:24px;">Please let me know if you have any questions.</p>
      <p style="font-size:15px;margin-top:8px;"><a href="${PUBLIC_SITE_URL}/book" style="color:#006b5f;font-weight:bold;">${PUBLIC_SITE_URL}/book</a></p>
    `,
  });
  return { subject: `Slots open at ${property} — ready to view?`, html };
}

async function sendWhatsApp(chatId: string, body: string) {
  if (!chatId || !BEEPER_API_TOKEN) return { skipped: true };
  try {
    const r = await fetch(`${BEEPER_API_URL}/v1/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEEPER_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chatID: chatId, text: body }),
    });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    console.error("[beeper send failed]:", (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}

// In dispatch():
case "lead-off-horizon-reminder": {
  if (!body?.lead_id) return { error: "lead_id required" };
  const lead = await loadLead(body.lead_id);
  const out: Record<string, unknown> = {};

  if (lead.email) {
    const t = tplOffHorizonReminder(lead);
    await sendEmail({ to: lead.email, subject: t.subject, html: t.html });
    out.email = lead.email;
  }
  if (lead.chat_id) {
    const property = (lead.property_interest && lead.property_interest[0]) || 'Lazybee';
    const wa = await sendWhatsApp(
      lead.chat_id,
      `Hi ${lead.name}, you mentioned a move-in around ${lead.intent?.target_move_in_date || 'your target date'}. We have viewing slots open at ${property} over the next two weekends. Want to lock one in?\n\nPlease let me know if you have any questions.\n\nhttps://lazybee.sg/book`
    );
    out.whatsapp = wa;
  }
  return { sent: true, ...out };
}
```

Note: the dispatcher signature must accept `lead_id` as well as `viewing_id`. Adjust the entrypoint:

```ts
const lead_id = body?.lead_id as string | undefined;
if (!event) { ... legacy ... }
if (event === 'lead-off-horizon-reminder') {
  // body shape: { event, lead_id }
  // pass body to dispatch through adjusted signature
}
```

**Commit:**
```
feat(viewing-notify): lead-off-horizon-reminder event (email + WhatsApp via Beeper)
```

---

## Task 10 — Admin Kanban hooks

**Files:**
- `src/pages/portal/admin/AdminViewingsPage.jsx` or wherever leads drawer lives (search first)
- `api/booking/[...path].js` (add `handleAdminLeadReminder`)

**What to do:**
1. Add `POST /api/booking/admin/leads/:id/reminder` handler (auth-gated).
2. In the leads drawer for off-horizon-flagged leads, show 2 buttons (Snooze 7d / Bump now). Wire to the new endpoint.

**Skeleton — API:**
```js
async function handleAdminLeadReminder(req, res, segments) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await isAdmin(req))) return res.status(403).json({ error: "Admin only" });
  const leadId = segments[2]; // segments = ['admin', 'leads', '<id>', 'reminder']
  const action = req.body?.action;
  if (!leadId) return res.status(400).json({ error: "lead id required" });
  if (!['snooze', 'bump', 'cancel'].includes(action)) {
    return res.status(400).json({ error: "action must be snooze | bump | cancel" });
  }

  const { data: lead, error: ferr } = await supabase
    .from("leads").select("id, intent, activity_log, status").eq("id", leadId).single();
  if (ferr || !lead) return res.status(404).json({ error: "Lead not found" });

  const intent = lead.intent || {};
  const log = lead.activity_log || [];

  if (action === 'snooze') {
    intent.reminder_due_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    log.push({ type: 'reminder_snoozed', actor: 'admin', when: new Date().toISOString() });
  } else if (action === 'bump') {
    // Fire viewing-notify immediately, increment count
    await fireNotifyLead("lead-off-horizon-reminder", leadId);
    intent.reminder_sent_count = (intent.reminder_sent_count || 0) + 1;
    intent.reminder_last_sent_at = new Date().toISOString();
    log.push({ type: 'reminder_bumped', actor: 'admin', when: new Date().toISOString() });
  } else if (action === 'cancel') {
    intent.off_horizon = false;
    intent.reminder_due_at = null;
    log.push({ type: 'off_horizon_cancelled', actor: 'admin', when: new Date().toISOString() });
  }

  await supabase.from("leads").update({ intent, activity_log: log }).eq("id", leadId);
  return res.status(200).json({ success: true });
}

// Add a sibling helper for lead-targeted notify:
async function fireNotifyLead(event, leadId) {
  try {
    await fetch(`${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/viewing-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.IOT_SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ event, lead_id: leadId }),
    });
  } catch (err) {
    console.error(`[viewing-notify ${event}] failed:`, err.message);
  }
}

// Dispatcher: route /api/booking/admin/leads/:id/reminder
// - segments: ['admin', 'leads', '<id>', 'reminder']
if (segments[0] === 'admin' && segments[1] === 'leads' && segments[3] === 'reminder') {
  return await handleAdminLeadReminder(req, res, segments);
}
```

**Skeleton — Admin UI button block (paste-in for whichever drawer file):**
```jsx
{lead.intent?.off_horizon && (
  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
    <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
      Off-horizon lead — target {lead.intent.target_move_in_date}
    </p>
    <p className="text-xs text-amber-700">
      Sent {lead.intent.reminder_sent_count || 0} reminders.
      {lead.intent.reminder_last_sent_at && ` Last: ${new Date(lead.intent.reminder_last_sent_at).toLocaleDateString()}`}
    </p>
    <div className="flex gap-2">
      <button
        onClick={() => snoozeReminder(lead.id)}
        className="px-3 py-1.5 bg-white border border-amber-300 rounded text-xs font-medium text-amber-800"
      >Snooze 7d</button>
      <button
        onClick={() => bumpReminder(lead.id)}
        className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-bold"
      >Bump now</button>
    </div>
  </div>
)}
```

**Commit:**
```
feat(admin): off-horizon reminder snooze + bump from leads drawer
```

---

## Task 11 — Env + cleanup

**Files:**
- `vercel.json` (verify cron path, no changes needed)
- `.env.vercel.prod` (manual — add `LAZYBEE_VIEWINGS_CAL_ID` mirroring `HYVE_VIEWINGS_CAL_ID`; not committed)
- `lazybee.md` §15 (delete the "Vercel todo: add LAZYBEE_VIEWINGS_CAL_ID" line — handled by code-side fallback)

**What to do:**
1. Confirm code reads `LAZYBEE_VIEWINGS_CAL_ID` with fallback to `HYVE_VIEWINGS_CAL_ID`.
2. Update `lazybee.md` to remove that TODO.
3. Add a single line to `lazybee.md` §2 noting V3 lives at the same `/book` path — windows-driven.

**Commit:**
```
chore: env fallback + update lazybee.md feature map for V3 booking
```

---

## Task 12 — E2E + Vercel preview verify

**What to do:**
1. Push branch — verify Vercel preview deploys green.
2. Apply the migration to a Supabase preview branch via MCP.
3. Smoke test the preview URL:
   - GET `/api/booking/windows?property=TG` returns the upcoming windows.
   - Insert a `booking window` GCal event for an upcoming window.
   - Re-fetch — state flips to `OPEN-ANY`.
   - POST `/api/booking/create` for a TG slot inside that window.
   - Re-fetch as `?property=CP` — verify buffer states.
   - POST off-horizon lead — verify row created with correct intent.
4. Update status file with preview URL.
5. Stop here. Mark reviews + merges to master.

**No commit.** Final report goes back to the orchestrator.

---

## Done criteria (overall)
- [ ] Migration applied (preview branch).
- [ ] All 12 unit tests pass.
- [ ] Vercel preview URL live and reachable.
- [ ] At least 1 successful synthetic booking through the new flow on preview.
- [ ] `claudine/status/viewing-clustering-status.md` updated with preview URL + test results.
- [ ] No production data modified.
