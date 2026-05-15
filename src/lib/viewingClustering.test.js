// Run with: node --test src/lib/viewingClustering.test.js
//
// Tests for the V3 booking clustering resolver + validator.
// Spec: docs/specs/2026-05-15-viewing-clustering.md

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSlots,
  validateBookingAttempt,
  listUpcomingWindows,
  buildWindowsResponse,
  WINDOW_STATE,
  SLOT_STATE,
} from "./viewingClustering.js";

// Helper: build the Friday 19:00-22:00 SGT window for 2026-05-15
function friWindow(dateStr = "2026-05-15") {
  const startMs = new Date(`${dateStr}T19:00:00+08:00`).getTime();
  const endMs   = new Date(`${dateStr}T22:00:00+08:00`).getTime();
  return { key: "fri-evening", dateIso: dateStr, startMs, endMs };
}

const openGcal = {
  start: "2026-05-15T19:00:00+08:00",
  end:   "2026-05-15T22:00:00+08:00",
  anchorProperty: null,
};
const openGcalAnchorTG = { ...openGcal, anchorProperty: "TG" };

// SGT 19:00 = UTC 11:00
const SLOT_AT = (sgt) => new Date(`2026-05-15T${sgt}:00+08:00`).toISOString();

test("closed window returns no slots", () => {
  const r = resolveSlots({
    propertyOfInterest: "TG",
    window: friWindow(),
    gcalEvent: null,
    bookings: [],
  });
  assert.equal(r.state, WINDOW_STATE.CLOSED);
  assert.equal(r.slots.length, 0);
});

test("open window, no bookings → 12 slots, all OPEN-ANY", () => {
  const r = resolveSlots({
    propertyOfInterest: "TG",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings: [],
  });
  assert.equal(r.state, WINDOW_STATE.OPEN_ANY);
  assert.equal(r.slots.length, 12);
  assert.ok(r.slots.every((s) => s.state === SLOT_STATE.OPEN_ANY));
});

test("TG booked at 19:45, TG prospect: BOOKED + PROP-RESERVED rest", () => {
  const bookings = [{
    slot_start: "2026-05-15T19:45:00+08:00",
    slot_end:   "2026-05-15T20:00:00+08:00",
    property_code: "TG",
    status: "confirmed",
  }];
  const r = resolveSlots({
    propertyOfInterest: "TG",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.equal(r.anchorProperty, "TG");
  const at1945 = r.slots.find((s) => s.start === SLOT_AT("19:45"));
  assert.equal(at1945.state, SLOT_STATE.BOOKED);
  // 19:00 is window-edge, but TG owns the cluster — still PROP_RESERVED
  const at1900 = r.slots.find((s) => s.start === SLOT_AT("19:00"));
  assert.equal(at1900.state, SLOT_STATE.PROP_RESERVED);
});

test("TG booked at 19:45, CP prospect: edge OPEN-ANY, near BLOCKED-BUFFER, far OPEN-ANY", () => {
  const bookings = [{
    slot_start: "2026-05-15T19:45:00+08:00",
    slot_end:   "2026-05-15T20:00:00+08:00",
    property_code: "TG",
    status: "confirmed",
  }];
  const r = resolveSlots({
    propertyOfInterest: "CP",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  // 19:00 is window edge → OPEN-ANY (exception)
  const at1900 = r.slots.find((s) => s.start === SLOT_AT("19:00"));
  assert.equal(at1900.state, SLOT_STATE.OPEN_ANY);
  // 19:30 is within 30 min before TG start (19:45) → BLOCKED-BUFFER
  const at1930 = r.slots.find((s) => s.start === SLOT_AT("19:30"));
  assert.equal(at1930.state, SLOT_STATE.BLOCKED_BUFFER);
  // 20:00 is the slot just after TG ends → BLOCKED-BUFFER (within 30 min)
  const at2000 = r.slots.find((s) => s.start === SLOT_AT("20:00"));
  assert.equal(at2000.state, SLOT_STATE.BLOCKED_BUFFER);
  // 20:30 is exactly 30 min after TG ends → OPEN-ANY (sub-anchor candidate)
  const at2030 = r.slots.find((s) => s.start === SLOT_AT("20:30"));
  assert.equal(at2030.state, SLOT_STATE.OPEN_ANY);
});

test("GCal pre-anchored TG — CP booking attempt rejected", () => {
  const result = validateBookingAttempt({
    propertyOfInterest: "CP",
    slotStartIso: "2026-05-15T19:00:00+08:00",
    window: friWindow(),
    gcalEvent: openGcalAnchorTG,
    bookings: [],
  });
  assert.ok(result);
  assert.equal(result.code, "wrong-property");
  assert.equal(result.payload.anchor_property, "TG");
});

test("Carl scenario: TG extension at 20:15 would invalidate booked CP at 20:30 → would-block-existing", () => {
  const bookings = [
    { slot_start: "2026-05-15T19:45:00+08:00", slot_end: "2026-05-15T20:00:00+08:00", property_code: "TG", status: "confirmed" },
    { slot_start: "2026-05-15T20:30:00+08:00", slot_end: "2026-05-15T20:45:00+08:00", property_code: "CP", status: "confirmed" },
  ];
  const result = validateBookingAttempt({
    propertyOfInterest: "TG",
    slotStartIso: "2026-05-15T20:15:00+08:00",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.ok(result);
  assert.equal(result.code, "would-block-existing");
});

test("Cross-property: CP at 20:00 immediately after TG ends 20:00 → travel-buffer", () => {
  const bookings = [{
    slot_start: "2026-05-15T19:45:00+08:00",
    slot_end:   "2026-05-15T20:00:00+08:00",
    property_code: "TG",
    status: "confirmed",
  }];
  const result = validateBookingAttempt({
    propertyOfInterest: "CP",
    slotStartIso: "2026-05-15T20:00:00+08:00",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.ok(result);
  assert.equal(result.code, "travel-buffer");
});

test("Cross-property: CP at 20:30 (exactly 30 min after TG end) → accepted", () => {
  const bookings = [{
    slot_start: "2026-05-15T19:45:00+08:00",
    slot_end:   "2026-05-15T20:00:00+08:00",
    property_code: "TG",
    status: "confirmed",
  }];
  const result = validateBookingAttempt({
    propertyOfInterest: "CP",
    slotStartIso: "2026-05-15T20:30:00+08:00",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.equal(result, null);
});

test("Slot already booked → slot-taken", () => {
  const bookings = [{
    slot_start: "2026-05-15T20:00:00+08:00",
    slot_end:   "2026-05-15T20:15:00+08:00",
    property_code: "TG",
    status: "confirmed",
  }];
  const result = validateBookingAttempt({
    propertyOfInterest: "TG",
    slotStartIso: "2026-05-15T20:00:00+08:00",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.ok(result);
  assert.equal(result.code, "slot-taken");
});

test("Same-property back-to-back same-property booking allowed", () => {
  const bookings = [{
    slot_start: "2026-05-15T20:00:00+08:00",
    slot_end:   "2026-05-15T20:15:00+08:00",
    property_code: "TG",
    status: "confirmed",
  }];
  const result = validateBookingAttempt({
    propertyOfInterest: "TG",
    slotStartIso: "2026-05-15T20:15:00+08:00",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  assert.equal(result, null);
});

test("Closed window: any booking attempt → window-closed", () => {
  const result = validateBookingAttempt({
    propertyOfInterest: "TG",
    slotStartIso: "2026-05-15T19:00:00+08:00",
    window: friWindow(),
    gcalEvent: null,
    bookings: [],
  });
  assert.ok(result);
  assert.equal(result.code, "window-closed");
});

test("Slot outside window range → slot-outside-window", () => {
  const result = validateBookingAttempt({
    propertyOfInterest: "TG",
    slotStartIso: "2026-05-15T18:00:00+08:00",  // before 19:00 start
    window: friWindow(),
    gcalEvent: openGcal,
    bookings: [],
  });
  assert.ok(result);
  assert.equal(result.code, "slot-outside-window");
});

test("listUpcomingWindows returns Fri/Sat/Sun within horizon", () => {
  // 2026-05-14 is Thursday — first window should be Fri 15
  const now = new Date("2026-05-14T12:00:00+08:00");
  const ws = listUpcomingWindows(now, 7);
  assert.ok(ws.length >= 3, `expected ≥ 3 windows, got ${ws.length}`);
  assert.equal(ws[0].key, "fri-evening");
  assert.equal(ws[1].key, "sat-morning");
  assert.equal(ws[2].key, "sun-afternoon");
});

test("buildWindowsResponse aggregates state per window", () => {
  const now = new Date("2026-05-14T12:00:00+08:00");
  const gcalEvents = [openGcal]; // only Fri-evening open
  const allBookings = [];
  const out = buildWindowsResponse({
    propertyOfInterest: "TG",
    now,
    gcalEvents,
    allBookings,
    horizonDays: 7,
  });
  // Fri-evening should be open (gcal event present)
  const fri = out.find((w) => w.key === "fri-evening" && w.date === "2026-05-15");
  assert.equal(fri.state, WINDOW_STATE.OPEN_ANY);
  assert.equal(fri.free_slot_count, 12);
  // Sat/Sun closed (no GCal event)
  const sat = out.find((w) => w.key === "sat-morning" && w.date === "2026-05-16");
  assert.equal(sat.state, WINDOW_STATE.CLOSED);
});

test("Cancellation re-anchor: removing booking unlocks anchor", () => {
  // Empty bookings + open GCal → no anchor
  const r = resolveSlots({
    propertyOfInterest: "CP",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings: [],
  });
  assert.equal(r.anchorProperty, null);
  assert.equal(r.state, WINDOW_STATE.OPEN_ANY);
  assert.ok(r.slots.every((s) => s.state === SLOT_STATE.OPEN_ANY));
});

test("Cross-property at far end: CP at 21:00 after TG cluster 19:45 → OPEN-ANY", () => {
  const bookings = [{
    slot_start: "2026-05-15T19:45:00+08:00",
    slot_end:   "2026-05-15T20:00:00+08:00",
    property_code: "TG",
    status: "confirmed",
  }];
  const r = resolveSlots({
    propertyOfInterest: "CP",
    window: friWindow(),
    gcalEvent: openGcal,
    bookings,
  });
  const at2100 = r.slots.find((s) => s.start === SLOT_AT("21:00"));
  assert.equal(at2100.state, SLOT_STATE.OPEN_ANY);
});
