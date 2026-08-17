// /api/booking/[...path]
//
// Single Vercel serverless function (catch-all) that handles all V2 viewing
// booking routes. Consolidated from 6 separate functions into one to fit the
// Hobby-plan 12-function cap.
//
// Routes:
//   GET  /api/booking/slots?property=IH&date=YYYY-MM-DD[&room=PR1]
//   POST /api/booking/create                  body: { property, room?, slot_start, name, email, phone, source?, notes? }
//   GET  /api/booking/cancel?token=...        → returns viewing details
//   POST /api/booking/cancel?token=...        → cancels viewing + cal event + emails
//   GET  /api/booking/auth/login              → admin-gated OAuth init
//   GET  /api/booking/auth/callback           → OAuth callback, displays refresh token once
//   GET  /api/booking/cron                    → runs reminder sweep (CRON_SECRET-gated)
//   POST /api/booking/owner-lead              → owner lead from lazybee.sg, emailed out
//                                               (public path /api/owners/lead, see vercel.json)
//
// Spec: docs/superpowers/specs/2026-05-06-lazybee-viewing-booking-v2-design.md

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import {
  normalizePropertyCode,
  normalizePhone,
  normalizeSource,
  generateCancelToken,
  isValidSgtIso,
  cancelUrlFor,
} from "../../src/lib/bookingHelpers.js";
import {
  getAvailableSlots,
  cancelEvent,
  listBookingCalendarState,
} from "../../src/lib/googleCalendar.js";
import {
  buildWindowsResponse,
  listUpcomingWindows,
  validateBookingAttempt,
} from "../../src/lib/viewingClustering.js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const SLOT_MINUTES = 30;

// ── Manual viewing windows (no Google Calendar) ───────────────────────
// Viewing windows are Saturdays 10:00–14:00 SGT, set manually — we no longer
// read Google Calendar to decide which windows are open (that was the cause
// of the recurring 503s). Every Saturday is open by default; a row in the
// optional `viewing_window_overrides` table (date, status='closed') closes a
// specific date. The read is defensive: if the table is absent, the default
// (every Saturday open) still applies, so this can never hard-fail a load.
const VIEWING_HORIZON_DAYS = 28;

async function getClosedWindowDates(startIso, endIso) {
  try {
    const { data, error } = await supabase
      .from("viewing_window_overrides")
      .select("date, status")
      .gte("date", startIso.slice(0, 10))
      .lte("date", endIso.slice(0, 10));
    if (error) return new Set();
    return new Set((data || []).filter((r) => r.status === "closed").map((r) => r.date));
  } catch {
    return new Set();
  }
}

// Synthesise an "open window" marker for every Saturday window in range that
// isn't manually closed. Shape matches what buildWindowsResponse and
// validateBookingAttempt expect from the old GCal events:
// { start, end, anchorProperty }. anchorProperty stays null (open to any
// property) — the cross-property clustering rules still apply on top.
function openWindowMarkers(now, horizonDays, closedDates) {
  return listUpcomingWindows(now, horizonDays)
    .filter((w) => w.key === "sat-morning" && !closedDates.has(w.dateIso))
    .map((w) => ({
      start: new Date(w.startMs).toISOString(),
      end: new Date(w.endMs).toISOString(),
      anchorProperty: null,
    }));
}

// ── shared helpers ────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function addMinutesIso(iso, mins) {
  const ms = new Date(iso).getTime() + mins * 60 * 1000;
  const offset = (iso.match(/([+-]\d{2}:?\d{2}|Z)$/) || [])[0] || "+08:00";
  const d = new Date(ms);
  const offsetMin =
    offset === "Z"
      ? 0
      : (() => {
          const m = offset.match(/^([+-])(\d{2}):?(\d{2})$/);
          if (!m) return 0;
          const sign = m[1] === "+" ? 1 : -1;
          return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
        })();
  const local = new Date(d.getTime() + offsetMin * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}${offset}`;
}

async function fireNotify(event, viewingId) {
  try {
    const r = await fetch(`${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/viewing-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.IOT_SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ event, viewing_id: viewingId }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error(`[viewing-notify ${event}] ${r.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[viewing-notify ${event}] failed:`, err.message);
  }
}

async function isAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const tokenFromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const tokenFromQuery = req.query?.token || null;
  const setupSecret = req.query?.setup_secret || null;

  if (
    setupSecret &&
    process.env.OAUTH_SETUP_SECRET &&
    setupSecret === process.env.OAUTH_SETUP_SECRET
  ) {
    return true;
  }
  const token = tokenFromHeader || tokenFromQuery;
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .single();
  return !!profile && ["ADMIN", "SUPER_ADMIN"].includes(profile.role);
}

function authorizedCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode
  const header = req.headers.authorization || "";
  if (header === `Bearer ${secret}`) return true;
  if (req.query?.secret === secret) return true;
  return false;
}

// ── route handlers ────────────────────────────────────────────────────

async function handleSlots(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const property = normalizePropertyCode(req.query?.property);
  const date = req.query?.date;
  if (!property) return res.status(400).json({ error: "property required" });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date required (YYYY-MM-DD)" });
  }
  const slots = await getAvailableSlots(date, property);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ slots });
}

// ── V3 windows endpoint ──────────────────────────────────────────────
// Returns the next 7 days of weekly viewing windows + slot states.
// Spec: docs/specs/2026-05-15-viewing-clustering.md §5.1
async function handleWindows(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const property = normalizePropertyCode(req.query?.property);
  if (!property) return res.status(400).json({ error: "property required" });
  if (!["CP", "IH", "TG"].includes(property)) {
    return res.status(400).json({ error: `unknown property '${property}'` });
  }

  const horizonDays = VIEWING_HORIZON_DAYS;
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  // No Google Calendar: Saturday windows are open by default, minus any
  // dates manually closed via viewing_window_overrides. blockers stay empty.
  const closedDates = await getClosedWindowDates(now.toISOString(), horizonEnd.toISOString());
  const gcalEvents = openWindowMarkers(now, horizonDays, closedDates);
  const blockers = [];

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
    .filter((b) => b.properties?.code)
    .map((b) => ({
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
    blockers,
    horizonDays,
  });

  // 48-hour lead time gate. Prospects can't book a slot that starts in less
  // than MIN_LEAD_HOURS from now — Mark needs prep time + tenant courtesy
  // notice. Env-overridable via BOOKING_MIN_LEAD_HOURS.
  const minLeadHours = Number(process.env.BOOKING_MIN_LEAD_HOURS || 48);
  const leadCutoffMs = now.getTime() + minLeadHours * 3600 * 1000;
  const gatedWindows = windows.map((w) => {
    const windowStartMs = new Date(w.window_start).getTime();
    if (windowStartMs < leadCutoffMs) {
      return {
        ...w,
        state: "CLOSED",
        anchor_property: null,
        free_slot_count: 0,
        slots: [],
        closed_reason: "min-lead-hours",
      };
    }
    return w;
  });

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    windows: gatedWindows,
    horizon_days: horizonDays,
    min_lead_hours: minLeadHours,
    rules_version: "v1",
    computed_at: new Date().toISOString(),
  });
}

// ── V3 off-horizon lead capture ──────────────────────────────────────
// Spec: docs/specs/2026-05-15-viewing-clustering.md §5.4
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
  if (!propertyCode || !["CP", "IH", "TG"].includes(propertyCode)) {
    return res.status(400).json({ error: "valid property required" });
  }
  if (!targetMoveInDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetMoveInDate)) {
    return res.status(400).json({ error: "target_move_in_date required (YYYY-MM-DD)" });
  }

  const moveInMs = Date.parse(`${targetMoveInDate}T00:00:00+08:00`);
  if (Number.isNaN(moveInMs)) {
    return res.status(400).json({ error: "invalid target_move_in_date" });
  }
  const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (moveInMs < sevenDaysFromNow) {
    return res.status(400).json({
      error:
        "target_move_in_date must be more than 7 days from now — use the main booking flow",
    });
  }

  const reminderDueAt = new Date(moveInMs - 10 * 24 * 60 * 60 * 1000).toISOString();

  const newIntent = {
    off_horizon: true,
    target_move_in_date: targetMoveInDate,
    reminder_due_at: reminderDueAt,
    reminder_channel: ["whatsapp", "email"],
    reminder_sent_count: 0,
    reminder_last_sent_at: null,
    preferred_property: propertyCode,
    preferred_room_code: roomCode,
  };

  const activityEntry = {
    type: "off_horizon_captured",
    actor: "system",
    when: new Date().toISOString(),
    payload: { target_move_in_date: targetMoveInDate, property: propertyCode },
  };

  // Dedup by email/phone like handleCreate does
  let existingLead = null;
  if (email) {
    const { data } = await supabase
      .from("leads")
      .select("id, intent, activity_log, property_interest, status")
      .eq("email", email)
      .maybeSingle();
    existingLead = data;
  }
  if (!existingLead && phone) {
    const { data } = await supabase
      .from("leads")
      .select("id, intent, activity_log, property_interest, status")
      .eq("phone", phone)
      .maybeSingle();
    existingLead = data;
  }

  let leadId;
  if (existingLead) {
    const mergedInterest = Array.from(
      new Set([...(existingLead.property_interest || []), propertyCode])
    );
    const mergedIntent = { ...(existingLead.intent || {}), ...newIntent };
    const mergedLog = [...(existingLead.activity_log || []), activityEntry];
    const newStatus =
      existingLead.status === "cold" ? "new" : existingLead.status || "new";
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
        status: newStatus,
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
        status: "new",
        intent: newIntent,
        activity_log: [activityEntry],
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[booking/leads/off-horizon] insert error:", error);
      return res.status(500).json({ error: "Failed to save lead" });
    }
    leadId = data.id;
  }

  return res.status(200).json({ success: true, lead_id: leadId });
}

// Helper used by /api/booking/admin/leads/:id/reminder — fires viewing-notify
// for a lead-targeted event (vs the existing fireNotify which is viewing-id).
async function fireNotifyLead(event, leadId) {
  try {
    const r = await fetch(
      `${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/viewing-notify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.IOT_SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ event, lead_id: leadId }),
      }
    );
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error(`[viewing-notify ${event}] ${r.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[viewing-notify ${event}] failed:`, err.message);
  }
}

// ── Admin: leads reminder snooze/bump/cancel ─────────────────────────
// Spec §5.5  — accessed as POST /api/booking/admin-lead-reminder?id=<lead-id>
// (Vercel's [...path].js routing matches single-segment paths only — nested
// paths like /admin/leads/<id>/reminder hit a 404 at the platform layer.)
async function handleAdminLeadReminder(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await isAdmin(req))) return res.status(403).json({ error: "Admin only" });
  const leadId = req.query?.id || req.body?.lead_id;
  const action = req.body?.action;
  if (!leadId) return res.status(400).json({ error: "lead id required" });
  if (!["snooze", "bump", "cancel"].includes(action)) {
    return res.status(400).json({ error: "action must be snooze | bump | cancel" });
  }

  const { data: lead, error: ferr } = await supabase
    .from("leads")
    .select("id, intent, activity_log, status")
    .eq("id", leadId)
    .single();
  if (ferr || !lead) return res.status(404).json({ error: "Lead not found" });

  const intent = { ...(lead.intent || {}) };
  const log = [...(lead.activity_log || [])];
  const nowIso = new Date().toISOString();

  if (action === "snooze") {
    intent.reminder_due_at = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    log.push({ type: "reminder_snoozed", actor: "admin", when: nowIso });
  } else if (action === "bump") {
    await fireNotifyLead("lead-off-horizon-reminder", leadId);
    intent.reminder_sent_count = (intent.reminder_sent_count || 0) + 1;
    intent.reminder_last_sent_at = nowIso;
    log.push({ type: "reminder_bumped", actor: "admin", when: nowIso });
  } else if (action === "cancel") {
    intent.off_horizon = false;
    intent.reminder_due_at = null;
    log.push({ type: "off_horizon_cancelled", actor: "admin", when: nowIso });
  }

  const { error: upErr } = await supabase
    .from("leads")
    .update({ intent, activity_log: log })
    .eq("id", leadId);
  if (upErr) {
    console.error("[admin-lead-reminder] update error:", upErr);
    return res.status(500).json({ error: "update failed" });
  }
  return res.status(200).json({ success: true });
}

// Admin-only: returns gcal blockers + booking windows for the next 14 days so
// the /portal/admin/viewings calendar grid can render Mark's real availability.
async function handleAdminCalendar(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!(await isAdmin(req))) return res.status(403).json({ error: "Admin only" });
  try {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 21); // 14d grid + buffer
    const state = await listBookingCalendarState(now.toISOString(), horizon.toISOString());
    return res.status(200).json({
      blockers: state.blockers || [],
      windows: state.windows || [],
    });
  } catch (err) {
    console.error("[admin-calendar] failed:", err);
    return res.status(500).json({ error: err.message || "gcal fetch failed" });
  }
}

async function handleCreate(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const propertyCode = normalizePropertyCode(body.property);
  // Multi-room (max 2). Accept either:
  //   rooms: ["TG-PR1", "TG-PR2"]   (V3, preferred)
  //   room:  "TG-PR1"               (legacy single, still supported)
  const roomCodesRaw = Array.isArray(body.rooms)
    ? body.rooms
    : body.room
      ? [body.room]
      : [];
  const roomCodes = roomCodesRaw
    .map((c) => (c == null ? null : String(c).trim()))
    .filter(Boolean)
    .slice(0, 2);
  const roomCode = roomCodes[0] || null; // legacy single-room var, still used below for back-compat
  const slotStart = body.slot_start;
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase() || null;
  const phone = normalizePhone(body.phone);
  const source = normalizeSource(body.source);
  const notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;

  if (!propertyCode) return res.status(400).json({ error: "property required" });
  if (!slotStart || !isValidSgtIso(slotStart)) {
    return res.status(400).json({ error: "slot_start required (ISO 8601 with offset)" });
  }
  if (!name || name.length < 2) return res.status(400).json({ error: "name required" });
  if (!email && !phone) return res.status(400).json({ error: "email or phone required" });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "invalid email" });
  }

  const slotEnd = addMinutesIso(slotStart, SLOT_MINUTES);
  if (Number.isNaN(new Date(slotStart).getTime())) {
    return res.status(400).json({ error: "invalid slot_start" });
  }

  // 48-hour lead time gate (mirrors handleWindows). Catches bots / replays
  // that bypass the UI. Admin path skips this — Mark's admin tools can
  // still force-create within the lead window when needed.
  const minLeadHours = Number(process.env.BOOKING_MIN_LEAD_HOURS || 48);
  if (body.rules_version !== "admin") {
    const hoursAhead = (new Date(slotStart).getTime() - Date.now()) / 3600_000;
    if (hoursAhead < minLeadHours) {
      return res.status(409).json({
        error: "too-soon",
        message: `Bookings require at least ${minLeadHours} hours notice — pick a slot from a later window.`,
        min_lead_hours: minLeadHours,
        hours_ahead: Math.round(hoursAhead * 10) / 10,
      });
    }
  }

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, name, code, address")
    .eq("code", propertyCode)
    .maybeSingle();
  if (propErr) {
    console.error("[booking/create] property lookup error:", propErr);
    return res.status(500).json({ error: "Property lookup failed" });
  }
  if (!property) return res.status(404).json({ error: `Unknown property '${propertyCode}'` });

  // Resolve all selected room codes to UUIDs. Validate every code belongs
  // to the picked property — refuse the booking if any code doesn't match
  // (prevents cross-property mistakes from URL tampering or stale UI state).
  let roomIds = [];
  let roomId = null;     // legacy mirror — first selected room
  let roomName = null;   // legacy mirror — first selected room display name
  if (roomCodes.length > 0) {
    const { data: matchedRooms, error: roomsErr } = await supabase
      .from("rooms")
      .select("id, name, unit_code")
      .eq("property_id", property.id)
      .in("unit_code", roomCodes);
    if (roomsErr) {
      console.error("[booking/create] rooms lookup error:", roomsErr);
      return res.status(500).json({ error: "Room lookup failed" });
    }
    const matched = matchedRooms || [];
    if (matched.length !== roomCodes.length) {
      const missing = roomCodes.filter(
        (c) => !matched.some((r) => (r.unit_code || "").toLowerCase() === c.toLowerCase()),
      );
      return res.status(400).json({
        error: "unknown_room",
        message: `Room(s) not found for ${propertyCode}: ${missing.join(", ")}`,
      });
    }
    // Preserve the order the prospect picked them in — first = primary
    roomIds = roomCodes.map(
      (c) => matched.find((r) => (r.unit_code || "").toLowerCase() === c.toLowerCase()).id,
    );
    const firstRoom = matched.find(
      (r) => (r.unit_code || "").toLowerCase() === roomCodes[0].toLowerCase(),
    );
    roomId = firstRoom.id;
    roomName = firstRoom.name || firstRoom.unit_code;
  }

  // Race-guard: DB
  const { data: existingDb, error: existingErr } = await supabase
    .from("property_viewings")
    .select("id")
    .eq("property_id", property.id)
    .eq("slot_start", slotStart)
    .neq("status", "cancelled")
    .limit(1);
  if (existingErr) {
    console.error("[booking/create] existing check error:", existingErr);
    return res.status(500).json({ error: "Slot lookup failed" });
  }
  if (existingDb && existingDb.length > 0) {
    return res.status(409).json({ error: "Slot just got booked, please pick another." });
  }

  // (Google freebusy race-guard removed — the DB race-guard above is the
  // single source of truth now that windows are manual, not calendar-driven.)

  // ── V3 cluster validation ─────────────────────────────────────────
  // Only enforced when the prospect submits via the V3 form (rules_version='v1').
  // V0 = grandfathered legacy bookings created via /api/booking/slots.
  // 'admin' = admin UI direct-create, bypasses validation entirely.
  const rulesVersion = body.rules_version === "admin"
    ? "admin"
    : body.rules_version === "v0"
      ? "v0"
      : "v1";

  if (rulesVersion === "v1") {
    const slotStartMs = new Date(slotStart).getTime();
    const upcomingWindows = listUpcomingWindows(new Date(), VIEWING_HORIZON_DAYS);
    const window = upcomingWindows.find(
      (w) => slotStartMs >= w.startMs && slotStartMs < w.endMs
    );
    if (!window) {
      return res.status(409).json({ error: "slot is not in any V3 viewing window" });
    }

    // No Google: the window is open if it's a Saturday window not manually
    // closed. Synthesise the marker validateBookingAttempt expects. No
    // blockers (those came from arbitrary GCal events, which we no longer read).
    const closedDates = await getClosedWindowDates(
      new Date(window.startMs).toISOString(),
      new Date(window.endMs).toISOString()
    );
    const gcalEvent =
      window.key === "sat-morning" && !closedDates.has(window.dateIso)
        ? {
            start: new Date(window.startMs).toISOString(),
            end: new Date(window.endMs).toISOString(),
            anchorProperty: null,
          }
        : null;
    const windowBlockers = [];

    // Fetch all bookings in this window (excluding cancelled)
    const { data: windowBookings, error: wbErr } = await supabase
      .from("property_viewings")
      .select("slot_start, slot_end, status, properties(code)")
      .in("status", ["pending", "confirmed"])
      .gte("slot_start", new Date(window.startMs).toISOString())
      .lt("slot_start", new Date(window.endMs).toISOString());
    if (wbErr) {
      console.error("[booking/create] window bookings fetch failed:", wbErr);
      return res.status(500).json({ error: "window bookings lookup failed" });
    }

    const bookingsForValidator = (windowBookings || [])
      .filter((b) => b.properties?.code)
      .map((b) => ({
        slot_start: b.slot_start,
        slot_end: b.slot_end,
        property_code: b.properties.code,
        status: b.status,
      }));

    const validation = validateBookingAttempt({
      propertyOfInterest: propertyCode,
      slotStartIso: slotStart,
      window,
      gcalEvent,
      bookings: bookingsForValidator,
      blockers: windowBlockers,
    });
    if (validation) {
      return res.status(409).json({
        error: validation.code,
        ...validation.payload,
      });
    }
  }

  const cancelToken = generateCancelToken();
  const viewingDate = slotStart.slice(0, 10);
  const viewingTime = slotStart.slice(11, 19);

  const { data: inserted, error: insErr } = await supabase
    .from("property_viewings")
    .insert({
      property_id: property.id,
      // room_ids[] is the canonical column. Trigger sync_property_viewings_room_id
      // mirrors room_ids[0] back to room_id so legacy queries keep working.
      room_ids: roomIds.length > 0 ? roomIds : null,
      room_id: roomId,
      prospect_name: name,
      prospect_email: email,
      prospect_phone: phone,
      viewing_date: viewingDate,
      viewing_time: viewingTime,
      slot_start: slotStart,
      slot_end: slotEnd,
      status: "confirmed",
      source,
      token: cancelToken,
      cancel_token: cancelToken,
      special_notes: notes,
      viewing_rules_version: rulesVersion,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("[booking/create] insert error:", insErr);
    return res.status(500).json({ error: "Failed to save viewing" });
  }
  const viewingId = inserted.id;

  // Lead upsert (non-fatal)
  try {
    let existingLead = null;
    if (email) {
      const { data } = await supabase
        .from("leads").select("id, property_interest").eq("email", email).maybeSingle();
      existingLead = data;
    }
    if (!existingLead && phone) {
      const { data } = await supabase
        .from("leads").select("id, property_interest").eq("phone", phone).maybeSingle();
      existingLead = data;
    }
    const interestArr = Array.from(
      new Set([...(existingLead?.property_interest || []), propertyCode])
    );
    if (existingLead) {
      await supabase
        .from("leads")
        .update({
          name,
          phone: phone || null,
          email: email || null,
          property_interest: interestArr,
          status: "viewing_booked",
          viewing_id: viewingId,
          source,
        })
        .eq("id", existingLead.id);
    } else {
      await supabase.from("leads").insert({
        name,
        email,
        phone,
        property_interest: interestArr,
        source,
        status: "viewing_booked",
        viewing_id: viewingId,
        notes,
      });
    }
  } catch (err) {
    console.error("[booking/create] lead upsert non-fatal error:", err);
  }

  // No Google Calendar event — viewings are tracked in property_viewings only.
  // The booking is confirmed purely by the email below.

  Promise.allSettled([
    fireNotify("viewing-confirmation", viewingId),
    fireNotify("viewing-captain-notify", viewingId),
    fireNotify("viewing-admin-notify", viewingId),
  ]).catch(() => {});

  return res.status(200).json({
    success: true,
    viewing_id: viewingId,
    cancel_url: cancelUrlFor(cancelToken),
  });
}

async function handleCancel(req, res) {
  const token = req.query?.token;
  if (!token || typeof token !== "string" || token.length < 16) {
    return res.status(400).json({ error: "Invalid token" });
  }
  const { data: viewing, error: fetchErr } = await supabase
    .from("property_viewings")
    .select(
      "id, status, slot_start, slot_end, prospect_name, prospect_email, prospect_phone, gcal_event_id, source, properties(name, code, address), rooms(name, unit_code)"
    )
    .eq("cancel_token", token)
    .maybeSingle();
  if (fetchErr) {
    console.error("[booking/cancel] fetch error:", fetchErr);
    return res.status(500).json({ error: "Lookup failed" });
  }
  if (!viewing) return res.status(404).json({ error: "Viewing not found" });

  if (req.method === "GET") {
    return res.status(200).json({
      viewing: {
        id: viewing.id,
        status: viewing.status,
        slot_start: viewing.slot_start,
        slot_end: viewing.slot_end,
        prospect_name: viewing.prospect_name,
        property_name: viewing.properties?.name || null,
        property_code: viewing.properties?.code || null,
        room_name: viewing.rooms?.name || viewing.rooms?.unit_code || null,
      },
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (viewing.status === "cancelled") {
    return res.status(200).json({ success: true, already_cancelled: true });
  }

  const { error: updErr } = await supabase
    .from("property_viewings")
    .update({ status: "cancelled" })
    .eq("id", viewing.id);
  if (updErr) {
    console.error("[booking/cancel] update error:", updErr);
    return res.status(500).json({ error: "Cancel failed" });
  }

  await supabase
    .from("leads")
    .update({ status: "new", viewing_id: null })
    .eq("viewing_id", viewing.id);

  if (viewing.gcal_event_id) {
    try { await cancelEvent(viewing.gcal_event_id); }
    catch (err) { console.error("[booking/cancel] gcal cancel non-fatal:", err); }
  }

  Promise.allSettled([fireNotify("viewing-cancelled", viewing.id)]).catch(() => {});
  return res.status(200).json({ success: true });
}

async function handleAuthLogin(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!(await isAdmin(req))) {
    return res.status(403).send(
      "Forbidden — admin only. Pass ?token=&lt;access_token&gt; or ?setup_secret=&lt;env value&gt;."
    );
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/booking/auth-callback`;
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not configured",
    });
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
  res.writeHead(302, { Location: url });
  res.end();
}

async function handleAuthCallback(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { code, error } = req.query;
  if (error) return res.status(400).send(`<h1>OAuth error</h1><p>${escapeHtml(error)}</p>`);
  if (!code) return res.status(400).send("<h1>Missing code</h1>");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/booking/auth-callback`;

  try {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token;
    const accessToken = tokens.access_token;

    if (!refreshToken) {
      return res.status(500).send(`
        <h1>No refresh token returned</h1>
        <p>Revoke at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> and try again.</p>
      `);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Lazybee OAuth — refresh token</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:760px;margin:48px auto;padding:0 16px;color:#121c2a}
  pre{background:#f3f4f6;padding:16px;border-radius:8px;word-break:break-all;white-space:pre-wrap;font-size:13px}
  .warn{background:#fff7ed;border:1px solid #fb923c;padding:16px;border-radius:8px;color:#9a3412}
  code{background:#f3f4f6;padding:2px 6px;border-radius:4px}
  h1{color:#006b5f}
</style></head><body>
<h1>Got a refresh token</h1>
<div class="warn">
  <strong>Copy this now — it will not be shown again.</strong><br>
  Add it to Vercel env as <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>, redeploy, then close this tab.
</div>
<h2>GOOGLE_OAUTH_REFRESH_TOKEN</h2>
<pre>${escapeHtml(refreshToken)}</pre>
<details><summary>Access token (short-lived)</summary><pre>${escapeHtml(accessToken || "(none)")}</pre></details>
</body></html>`);
  } catch (err) {
    return res.status(500).send(`<h1>Token exchange failed</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
}

async function handleCron(req, res) {
  if (!authorizedCron(req)) return res.status(403).json({ error: "Forbidden" });

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // ── (NEW) off-horizon lead reminder sweep ───────────────────────
  // Daily — fires viewing-notify lead-off-horizon-reminder for off-horizon
  // leads whose intent.reminder_due_at <= now, capped at 1/7d and 2 lifetime.
  const offHorizonSweep = { count: 0, results: [] };
  try {
    const { data: dueLeads, error: dueErr } = await supabase
      .from("leads")
      .select("id, name, email, phone, intent, activity_log, status")
      .in("status", ["new", "qualified"])
      .filter("intent->>off_horizon", "eq", "true")
      .filter("intent->>reminder_due_at", "lte", nowIso);

    if (dueErr) {
      console.error("[booking/cron] off-horizon sweep query error:", dueErr);
    } else {
      for (const lead of dueLeads || []) {
        const intent = lead.intent || {};
        const sentCount = parseInt(intent.reminder_sent_count || 0, 10);
        const lastSent = intent.reminder_last_sent_at;
        if (sentCount >= 2) continue;
        if (lastSent && new Date(lastSent).getTime() > now - 7 * 24 * 60 * 60 * 1000) {
          continue;
        }

        await fireNotifyLead("lead-off-horizon-reminder", lead.id);

        const newSentCount = sentCount + 1;
        const newIntent = {
          ...intent,
          reminder_sent_count: newSentCount,
          reminder_last_sent_at: nowIso,
        };
        const newLog = [
          ...(lead.activity_log || []),
          {
            type: "reminder_fired",
            actor: "cron",
            when: nowIso,
            payload: { channel: "whatsapp+email", count: newSentCount },
          },
        ];
        const newStatus = newSentCount >= 2 ? "cold" : lead.status;
        if (newSentCount >= 2) {
          newLog.push({ type: "auto_marked_cold", actor: "cron", when: nowIso });
        }
        await supabase
          .from("leads")
          .update({ intent: newIntent, activity_log: newLog, status: newStatus })
          .eq("id", lead.id);

        offHorizonSweep.count += 1;
        offHorizonSweep.results.push({ id: lead.id, sent_count: newSentCount });
      }
    }
  } catch (err) {
    console.error("[booking/cron] off-horizon sweep fatal:", err);
  }

  // Daily cron — broadened window 12-36h to catch all next-day viewings
  const lo24 = new Date(now + 12 * 60 * 60 * 1000).toISOString();
  const hi24 = new Date(now + 36 * 60 * 60 * 1000).toISOString();

  const { data: due24, error: err24 } = await supabase
    .from("property_viewings")
    .select("id")
    .eq("status", "confirmed")
    .is("reminder_24h_sent_at", null)
    .gte("slot_start", lo24)
    .lte("slot_start", hi24);
  if (err24) {
    console.error("[booking/cron] 24h sweep error:", err24);
    return res.status(500).json({ error: err24.message });
  }

  const r24 = { count: due24?.length || 0, results: [] };
  for (const v of due24 || []) {
    await fireNotify("viewing-reminder-24h", v.id);
    r24.results.push({ id: v.id });
  }

  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    off_horizon: offHorizonSweep,
    reminder_24h: r24,
  });
}

// ── owner leads (lazybee.sg homepage) ─────────────────────────────────
//
// Reached as POST /api/owners/lead, rewritten here by vercel.json. It lives in
// this catch-all rather than its own file only because the Hobby plan caps the
// repo at 12 functions, which is the same reason the viewing routes were
// consolidated here in the first place.
//
// The homepage has always computed a full brief for the owner. Until now that
// brief died in the browser: the form called `track()`, `track()` no-ops when
// PostHog has no key, and PostHog has no key in production. Every owner who
// filled the form was dropped silently.
//
// This is deliberately email-only: Mark works the leads from his inbox, so
// there is no table to keep in sync. The consequence is that a failed send
// loses the lead, which is exactly the bug being removed, so this route must
// report failure honestly and let the form offer a WhatsApp fallback. Never
// return 200 for a send we did not make.

const OWNER_NOTIFY_TO = (process.env.RESERVE_NOTIFY_TO || "admin@hyve.sg,mark@meetmillia.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Same verified sender the portal already uses for tenant mail. */
async function sendOwnerEmail(to, subject, html, replyTo) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Lazybee Co-living <hello@lazybee.sg>",
      reply_to: replyTo || "hello@lazybee.sg",
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`resend ${r.status}: ${text.slice(0, 300)}`);
  return text;
}

const ownerEsc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ownerSgd = (n) =>
  Number.isFinite(Number(n)) ? `S$${Math.round(Number(n)).toLocaleString("en-SG")}` : "";

/** An owner who typed an email gets a reply-to; a phone number does not. */
function ownerReplyTo(contact) {
  const c = String(contact || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : null;
}

function ownerLeadHtml(b) {
  const rows = [
    ["Contact", b.contact],
    ["Postal code", b.postal_code],
    ["District", [b.district, b.district_name].filter(Boolean).join(" ")],
    ["Floor area", b.floor_area_sqft ? `${Number(b.floor_area_sqft).toLocaleString("en-SG")} sqft` : ""],
    ["Bedrooms", b.bedrooms],
    ["psf used", b.psf_used],
    ["Market rent", b.market_rent_monthly ? `${ownerSgd(b.market_rent_monthly)} / mo` : ""],
    ["Floor we would offer", b.floor_offered_monthly ? `${ownerSgd(b.floor_offered_monthly)} / mo` : ""],
    ["Modelled owner year", ownerSgd(b.modelled_owner_year)],
    ["Fixed lease year", ownerSgd(b.modelled_lease_year)],
    ["Uplift", b.uplift_pct != null ? `${b.uplift_pct}%` : ""],
    ["Hero variant", b.hero_variant],
    ["Captured", b.captured_at],
  ]
    .filter(([, v]) => v !== "" && v != null)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#888;white-space:nowrap">${ownerEsc(k)}</td>` +
        `<td style="padding:6px 0"><strong>${ownerEsc(v)}</strong></td></tr>`
    )
    .join("");

  const a = b.assumptions || {};
  return `<p style="font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#B08D4F;margin:0 0 10px">New owner lead</p>
<h2 style="font-weight:400;margin:0 0 4px">${ownerEsc(b.district_name || b.postal_code || "Unit")}</h2>
<p style="color:#888;margin:0 0 18px">From ${ownerEsc(b.source || "lazybee.sg")}</p>
<table style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px">${rows}</table>
<p style="color:#888;font-size:12px;margin-top:18px">Assumptions used: uplift ${ownerEsc(a.uplift)}, opex ${ownerEsc(a.opex)}, floor ${ownerEsc(a.floor_pct)}, share ${ownerEsc(a.share)}.</p>
<p style="color:#888;font-size:12px">The owner has been told someone will reach out within a day.</p>`;
}

async function handleOwnerLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const contact = String(body.contact || "").trim();

  // The contact is the only thing that makes a lead actionable.
  if (!contact) return res.status(400).json({ error: "contact_required" });

  const where =
    [body.district, body.district_name].filter(Boolean).join(" ") || body.postal_code || "Singapore";
  const size = body.floor_area_sqft
    ? `, ${Number(body.floor_area_sqft).toLocaleString("en-SG")} sqft`
    : "";

  try {
    await sendOwnerEmail(
      OWNER_NOTIFY_TO,
      `New owner lead: ${where}${size}`,
      ownerLeadHtml(body),
      ownerReplyTo(contact)
    );
  } catch (err) {
    // Loud on purpose. A silent failure here is the original bug.
    console.error("[owner-lead] send failed", { contact, where, error: String(err) });
    return res.status(502).json({ error: "send_failed" });
  }

  return res.status(200).json({ ok: true });
}

// ── dispatcher ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS headers (vercel.json also sets these but be explicit)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Resolve the route from URL (req.query.path is unreliable for catch-all
  // in non-Next.js Vercel functions). Strip the /api/booking/ prefix.
  let pathFromQuery = req.query?.path;
  if (typeof pathFromQuery === "string") pathFromQuery = pathFromQuery.split("/").filter(Boolean);
  const segmentsFromUrl = (req.url || "")
    .split("?")[0]
    .replace(/^\/api\/booking\/?/, "")
    .split("/")
    .filter(Boolean);
  const segments = Array.isArray(pathFromQuery) && pathFromQuery.length > 0 ? pathFromQuery : segmentsFromUrl;
  const route = segments.join("/");

  try {
    switch (route) {
      case "slots":
        return await handleSlots(req, res);
      case "windows":
        return await handleWindows(req, res);
      case "create":
        return await handleCreate(req, res);
      case "cancel":
        return await handleCancel(req, res);
      // A vercel.json rewrite sends /api/owners/lead here, but a rewrite does not
      // change req.url, so the /api/booking/ strip above leaves the original path
      // intact and the route arrives as "api/owners/lead". Both spellings resolve,
      // the same way the auth routes accept two forms.
      case "owner-lead":
      case "api/owners/lead":
      case "owners/lead":
        return await handleOwnerLead(req, res);
      case "leads-off-horizon":
        return await handleOffHorizonLead(req, res);
      case "admin-lead-reminder":
        return await handleAdminLeadReminder(req, res);
      case "admin-calendar":
        return await handleAdminCalendar(req, res);
      case "auth-login":
      case "auth/login":
        return await handleAuthLogin(req, res);
      case "auth-callback":
      case "auth/callback":
        return await handleAuthCallback(req, res);
      case "cron":
        return await handleCron(req, res);
      default:
        return res.status(404).json({ error: `Unknown route: /api/booking/${route}` });
    }
  } catch (err) {
    console.error(`[/api/booking/${route}] fatal:`, err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
