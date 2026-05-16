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
  snippet,
} from "../../src/lib/bookingHelpers.js";
import {
  getAvailableSlots,
  isSlotStillFree,
  createEvent,
  cancelEvent,
  listBookingWindowEvents,
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

  const horizonDays = 7;
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  let gcalEvents = [];
  try {
    gcalEvents = await listBookingWindowEvents(now.toISOString(), horizonEnd.toISOString());
  } catch (err) {
    console.error("[booking/windows] gcal failed:", err);
    return res.status(503).json({ error: "calendar service unavailable" });
  }

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

  // Race-guard: Google freebusy (kept from V2 for legacy paths). When the
  // request comes through the V3 form, the cluster validator below is the
  // primary gate.
  let stillFree = true;
  try {
    stillFree = await isSlotStillFree(slotStart, slotEnd);
  } catch (err) {
    console.error("[booking/create] freebusy check failed:", err);
    return res.status(503).json({
      error: "Calendar service unavailable, please try again in a moment.",
    });
  }
  if (!stillFree) {
    return res.status(409).json({ error: "Slot just got booked, please pick another." });
  }

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
    const upcomingWindows = listUpcomingWindows(new Date(), 7);
    const window = upcomingWindows.find(
      (w) => slotStartMs >= w.startMs && slotStartMs < w.endMs
    );
    if (!window) {
      return res.status(409).json({ error: "slot is not in any V3 viewing window" });
    }

    // Fetch GCal event for this window (if any)
    let gcalEvent = null;
    try {
      const events = await listBookingWindowEvents(
        new Date(window.startMs - 60_000).toISOString(),
        new Date(window.endMs + 60_000).toISOString()
      );
      gcalEvent =
        events.find(
          (e) => Math.abs(new Date(e.start).getTime() - window.startMs) <= 5 * 60_000
        ) || null;
    } catch (err) {
      console.error("[booking/create] gcal lookup failed:", err);
      return res.status(503).json({ error: "calendar service unavailable" });
    }

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

  // Google Cal event (non-fatal)
  let gcalEventId = null;
  try {
    const summary = `Lazybee Viewing — ${name} @ ${propertyCode}${roomName ? "-" + roomName : ""}`;
    const description = [
      `Prospect: ${name}`,
      email ? `Email: ${email}` : null,
      phone ? `Phone: ${phone}` : null,
      `Property: ${property.name} (${propertyCode})`,
      roomName ? `Room: ${roomName}` : "Room: any available",
      `Source: ${source}`,
      notes ? `Notes: ${snippet(notes, 500)}` : null,
      "",
      `Cancel: ${cancelUrlFor(cancelToken)}`,
    ].filter(Boolean).join("\n");
    const ev = await createEvent({
      summary,
      description,
      start: slotStart,
      end: slotEnd,
      attendees: email ? [email] : [],
    });
    gcalEventId = ev?.id || null;
    if (gcalEventId) {
      await supabase
        .from("property_viewings")
        .update({ gcal_event_id: gcalEventId })
        .eq("id", viewingId);
    }
  } catch (err) {
    console.error("[booking/create] gcal createEvent failed:", err);
  }

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

  // 2h sweep available via ?include_2h=1 only (Hobby cron is daily)
  let r2 = { skipped: "daily-cron" };
  if (req.query?.include_2h) {
    const lo2 = new Date(now + 1.5 * 60 * 60 * 1000).toISOString();
    const hi2 = new Date(now + 2.5 * 60 * 60 * 1000).toISOString();
    const { data: due2 } = await supabase
      .from("property_viewings")
      .select("id")
      .eq("status", "confirmed")
      .is("reminder_2h_sent_at", null)
      .gte("slot_start", lo2)
      .lte("slot_start", hi2);
    r2 = { count: due2?.length || 0, results: [] };
    for (const v of due2 || []) {
      await fireNotify("viewing-reminder-2h", v.id);
      r2.results.push({ id: v.id });
    }
  }

  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    off_horizon: offHorizonSweep,
    reminder_24h: r24,
    reminder_2h: r2,
  });
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
      case "leads-off-horizon":
        return await handleOffHorizonLead(req, res);
      case "admin-lead-reminder":
        return await handleAdminLeadReminder(req, res);
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
