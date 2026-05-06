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
// Spec: docs/superpowers/specs/2026-05-06-hyve-viewing-booking-v2-design.md

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
} from "../../src/lib/googleCalendar.js";

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

async function handleCreate(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const propertyCode = normalizePropertyCode(body.property);
  const roomCode = body.room ? String(body.room).trim() : null;
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

  let roomId = null;
  let roomName = null;
  if (roomCode) {
    const { data: room } = await supabase
      .from("rooms")
      .select("id, name, unit_code")
      .eq("property_id", property.id)
      .or(`unit_code.eq.${roomCode},name.eq.${roomCode}`)
      .maybeSingle();
    if (room) {
      roomId = room.id;
      roomName = room.name || room.unit_code;
    }
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

  // Race-guard: Google freebusy
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

  const cancelToken = generateCancelToken();
  const viewingDate = slotStart.slice(0, 10);
  const viewingTime = slotStart.slice(11, 19);

  const { data: inserted, error: insErr } = await supabase
    .from("property_viewings")
    .insert({
      property_id: property.id,
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
      cancel_token: cancelToken,
      special_notes: notes,
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
    const summary = `Hyve Viewing — ${name} @ ${propertyCode}${roomName ? "-" + roomName : ""}`;
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
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/booking/auth/callback`;
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
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/booking/auth/callback`;

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
<html><head><meta charset="utf-8"><title>Hyve OAuth — refresh token</title>
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

  // Daily cron — broadened window 12-36h to catch all next-day viewings
  const now = Date.now();
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

  return res.status(200).json({ ok: true, ts: new Date().toISOString(), reminder_24h: r24, reminder_2h: r2 });
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
      case "create":
        return await handleCreate(req, res);
      case "cancel":
        return await handleCancel(req, res);
      case "auth/login":
        return await handleAuthLogin(req, res);
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
