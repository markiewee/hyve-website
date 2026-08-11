// /api/v1/[...path]
//
// Lazybee Partner API v1. Single catch-all serverless function, same shape as
// /api/booking/[...path].js and for the same reason: the Hobby plan caps this
// repo at 12 functions. All logic that can be pure lives in src/lib/partner*
// with tests beside it; this file is wiring.
//
// Routes (all under /api/v1):
//   GET    /ping
//   GET    /properties            GET /properties/{slug}
//   GET    /listings              GET /listings/{code}
//   GET    /listings/{code}/calendar
//   POST   /booking-requests      GET /booking-requests/{id}
//   GET    /webhooks              POST /webhooks       DELETE /webhooks/{id}
//   POST   /internal/dispatch     (secret-gated, not partner-facing)
//
// Spec: docs/superpowers/specs/2026-08-10-partner-api-v1.md

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { hashKey, parseAuthHeader, allowRequest } from "../../src/lib/partnerAuth.js";
import { calendarView } from "../../src/lib/partnerWindows.js";
import { mergeProfiles, listingResource, propertyResource } from "../../src/lib/partnerSerialize.js";
import { EVENT_TYPES, signPayload } from "../../src/lib/partnerWebhooks.js";
import { validateBooking, bookingView, isIsoDate } from "../../src/lib/partnerBookings.js";
import { buildPlacementPatch } from "../../src/lib/partnerPlacements.js";
import { bookingRequestEmail, bookingEmail, bookingCancelledEmail } from "../../src/lib/partnerNotify.js";
import { sellStateView } from "../../src/lib/partnerSellState.js";
import {
  validateLead, leadPatch, leadView, mergeIdentifiers, normalisePhone,
  leadUpdatePatch, validateLeadUpdate,
} from "../../src/lib/partnerLeads.js";
import { validateTicket, ticketInsert, ticketView } from "../../src/lib/partnerTickets.js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const CALENDAR_HORIZON_DAYS = 365;
const DEFAULT_DURATION_MONTHS = 12;
const MAX_DELIVERY_ATTEMPTS = 8;

const err = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

// Unit codes are stored uppercase; partners send what their templating
// produces. /listings/ih-std1 returning 404 was pure friction.
const up = (s) => (typeof s === "string" ? s.trim().toUpperCase() : s);

// ── Partner auth ─────────────────────────────────────────────────────
// Key -> channel row. Channel must be enabled (the kill switch gates the
// whole API) and the key not revoked. Rate limiting is one atomic
// upsert-and-increment in Postgres (fn_rate_bump): the previous version
// counted api_request_log BEFORE this request's row landed, so any burst
// of concurrent requests all read the same low count and all passed.
async function authenticate(req) {
  const key = parseAuthHeader(req.headers.authorization);
  if (!key) return { error: [401, "unauthorized", "Missing or malformed Authorization header"] };
  const { data: keyRow } = await supabase
    .from("channel_api_keys")
    .select("id, rate_limit_per_min, revoked_at, scope, channel:listing_channels(id, slug, name, enabled, commission_pct, commission_months, gross_up, fee_fixed)")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (!keyRow || keyRow.revoked_at) return { error: [401, "unauthorized", "Unknown or revoked key"] };
  if (!keyRow.channel?.enabled) return { error: [403, "channel_disabled", "This channel is not enabled"] };
  const { data: used, error: rlErr } = await supabase.rpc("fn_rate_bump", { p_key_id: keyRow.id });
  // A broken limiter fails OPEN: partners losing service to our own
  // plumbing is worse than a minute of unmetered requests.
  const slot = Number(used);
  if (!rlErr && Number.isFinite(slot) && !allowRequest(slot, keyRow.rate_limit_per_min ?? 60))
    return { error: [429, "rate_limited", "Rate limit exceeded; slow down"], retryAfter: 30 };
  return { keyRow };
}

async function logRequest(keyId, req, status, startedMs) {
  try {
    await supabase.from("api_request_log").insert({
      key_id: keyId, method: req.method, path: req.url?.slice(0, 200) ?? "",
      status, ms: Date.now() - startedMs,
    });
    await supabase.from("channel_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyId);
  } catch { /* audit must never break serving */ }
}

// ── Data loads ───────────────────────────────────────────────────────
async function loadPropertyProfiles() {
  const { data } = await supabase
    .from("listing_profiles")
    .select("property_id, title, description, fields, updated_at, property:properties(id, name, slug, images, amenities)")
    .eq("scope", "PROPERTY");
  return data ?? [];
}

async function loadRoomListings() {
  const { data } = await supabase
    .from("listing_profiles")
    .select("room_id, title, description, fields, updated_at, room:rooms(id, unit_code, price_monthly, deposit_months, min_stay_months, max_occupancy, photos, amenities, property_id)")
    .eq("scope", "ROOM");
  return (data ?? []).filter((r) => r.room && r.room.unit_code);
}

// Rooms this partner must not see: an explicit PAUSED placement for this
// channel. Placements are outbound-push state, so "no row" means visible;
// PAUSED is the one status that reads as a deliberate per-room off switch.
async function pausedRoomIds(channelId) {
  const { data } = await supabase
    .from("listing_placements")
    .select("room_id, status")
    .eq("channel_id", channelId)
    .eq("status", "PAUSED");
  return new Set((data ?? []).map((p) => p.room_id));
}

async function availableFromFor(roomId) {
  const { data } = await supabase.rpc("fn_room_next_available", { p_room_id: roomId });
  return typeof data === "string" ? data : null;
}

// ── Handlers ─────────────────────────────────────────────────────────
async function handleProperties(res, slugFilter) {
  const [props, listings] = await Promise.all([loadPropertyProfiles(), loadRoomListings()]);
  const countByProperty = {};
  for (const l of listings) countByProperty[l.room.property_id] = (countByProperty[l.room.property_id] ?? 0) + 1;
  const out = props
    .filter((p) => p.property && (!slugFilter || p.property.slug === slugFilter))
    .map((p) => propertyResource({
      slug: p.property.slug,
      profile: { title: p.title ?? p.property.name, description: p.description, fields: p.fields },
      listingCount: countByProperty[p.property.id] ?? 0,
      updatedAt: p.updated_at,
      fallbackMedia: p.property.images,
      fallbackFeatures: p.property.amenities,
    }));
  if (slugFilter && out.length === 0) return err(res, 404, "not_found", "No such property");
  return res.status(200).json(slugFilter ? out[0] : { data: out });
}

function clampDuration(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DURATION_MONTHS;
  return Math.min(Math.max(n, 3), 36);
}

async function handleListings(res, channel, query, codeFilter) {
  const [props, listings, paused] = await Promise.all([
    loadPropertyProfiles(), loadRoomListings(), pausedRoomIds(channel.id),
  ]);
  const propProfileById = Object.fromEntries(props.filter((p) => p.property).map((p) => [p.property.id, p]));
  const duration = clampDuration(query.duration_months);
  const rows = [];
  try {
    for (const l of listings) {
      if (codeFilter && l.room.unit_code !== codeFilter) continue;
      if (paused.has(l.room.id)) continue;
      const propRow = propProfileById[l.room.property_id];
      if (query.property && propRow?.property?.slug !== query.property) continue;
      const profile = mergeProfiles(
        propRow ? { title: propRow.title, description: propRow.description, fields: propRow.fields } : null,
        { title: l.title, description: l.description, fields: l.fields }
      );
      const availableFrom = await availableFromFor(l.room.id);
      if (query.available_from && availableFrom && availableFrom > query.available_from) continue;
      const resource = listingResource({
        code: l.room.unit_code, propertySlug: propRow?.property?.slug ?? null, profile,
        room: l.room, channel, availableFrom, durationMonths: duration, updatedAt: l.updated_at,
      });
      if (query.max_rate && resource.rate_card.monthly_rate > Number(query.max_rate)) continue;
      rows.push(resource);
    }
  } catch (e) {
    // quotedPrice refuses impossible commission/duration combinations loudly;
    // that is a caller problem, not a server fault.
    return err(res, 422, "validation_failed", String(e.message ?? e));
  }
  if (codeFilter) {
    if (rows.length === 0) return err(res, 404, "not_found", "No such listing");
    return res.status(200).json(rows[0]);
  }
  return res.status(200).json({ data: rows });
}

async function handleCalendar(res, code) {
  const { data: room } = await supabase.from("rooms").select("id, unit_code").eq("unit_code", code).maybeSingle();
  if (!room) return err(res, 404, "not_found", "No such listing");
  const from = new Date().toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("room_calendar")
    .select("starts_on, ends_on")
    .eq("room_id", room.id).eq("status", "ACTIVE").eq("blocks", true);
  return res.status(200).json({
    listing: code,
    from, horizon_days: CALENDAR_HORIZON_DAYS,
    windows: calendarView(rows ?? [], { from, horizonDays: CALENDAR_HORIZON_DAYS }),
  });
}

const bookingRequestView = (row, code) => ({
  id: row.id, listing_code: code, status: row.status, created_at: row.created_at,
});

// Resend, the portal's transport (see api/portal/claim-reserve.js). Subject
// and body come from partnerNotify.js, where their wording is pinned by tests.
async function sendAdminEmail({ subject, text }) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Lazybee Co-living <hello@lazybee.sg>",
        to: ["admin@lazybee.sg"],
        subject,
        text,
      }),
    });
  } catch { /* notification failure must not fail the request */ }
}

// Enough room to price and place the booking in an email: sales needs the
// money and the building, not just a unit code.
const ROOM_FOR_EMAIL = "id, unit_code, name, price_monthly, deposit_months, property:properties(name)";

async function handleCreateBookingRequest(req, res, channel) {
  const b = req.body ?? {};
  b.listing_code = up(b.listing_code);
  const missing = ["listing_code", "move_in", "duration_months"].filter((f) => !b[f]);
  if (!b.applicant?.name || !b.applicant?.email) missing.push("applicant.name/email");
  if (missing.length) return err(res, 422, "validation_failed", `Missing: ${missing.join(", ")}`);
  // Reject before Postgres gets a chance to coerce ("01/06/2027" became a
  // January hold live) or to 500 on garbage like 2027-13-45.
  if (!isIsoDate(b.move_in))
    return err(res, 422, "validation_failed", "move_in must be an ISO date (YYYY-MM-DD)");
  const dur = Number(b.duration_months);
  if (!Number.isInteger(dur) || dur < 1 || dur > 60)
    return err(res, 422, "validation_failed", "duration_months must be a whole number of months (1 to 60)");
  const { data: room } = await supabase.from("rooms").select(ROOM_FOR_EMAIL).eq("unit_code", b.listing_code).maybeSingle();
  if (!room) return err(res, 422, "validation_failed", "Unknown listing_code");

  if (b.idempotency_key) {
    const { data: existing } = await supabase
      .from("booking_requests").select("id, status, created_at")
      .eq("channel_id", channel.id).eq("idempotency_key", b.idempotency_key).maybeSingle();
    if (existing) return res.status(200).json(bookingRequestView(existing, room.unit_code));
  }

  // Enquiry records, never blocks: Mark's rule, enforced at insert.
  const { data: cal } = await supabase.from("room_calendar").insert({
    room_id: room.id, starts_on: b.move_in, ends_on: null, kind: "ENQUIRY",
    source: channel.slug, status: "ACTIVE", blocks: false, auto_created: true,
    notes: "Partner API booking request",
  }).select("id").single();

  const { data: created, error: insErr } = await supabase.from("booking_requests").insert({
    channel_id: channel.id, room_id: room.id, idempotency_key: b.idempotency_key ?? null,
    move_in: b.move_in, duration_months: b.duration_months,
    applicant_name: b.applicant.name, applicant_email: b.applicant.email,
    applicant_phone: b.applicant.phone ?? null, applicant_nationality: b.applicant.nationality ?? null,
    note: b.note ?? null, calendar_id: cal?.id ?? null,
  }).select("id, status, created_at").single();
  if (insErr) return err(res, 500, "internal", "Could not record the request");

  await sendAdminEmail(bookingRequestEmail({ channel, room, request: b, requestId: created.id }));
  return res.status(201).json(bookingRequestView(created, room.unit_code));
}

async function handleGetBookingRequest(res, channel, id) {
  const { data } = await supabase
    .from("booking_requests").select("id, status, created_at, room:rooms(unit_code)")
    .eq("id", id).eq("channel_id", channel.id).maybeSingle();
  if (!data) return err(res, 404, "not_found", "No such booking request for this key");
  return res.status(200).json(bookingRequestView(data, data.room?.unit_code ?? null));
}

// ── Bookings: confirmed holds (v1.1). No overlap checks, ever: Mark
// overbooks deliberately, so the API records what it is told. ──────────
async function handleCreateBooking(req, res, channel) {
  const b = req.body ?? {};
  b.listing_code = up(b.listing_code);
  const v = validateBooking(b);
  if (!v.ok) return err(res, 422, "validation_failed", `Missing or invalid: ${v.missing.join(", ")}`);
  const { data: room } = await supabase.from("rooms").select(ROOM_FOR_EMAIL).eq("unit_code", b.listing_code).maybeSingle();
  if (!room) return err(res, 422, "validation_failed", "Unknown listing_code");

  if (b.idempotency_key) {
    const { data: existing } = await supabase
      .from("channel_bookings").select("id, starts_on, ends_on, status, external_ref, created_at")
      .eq("channel_id", channel.id).eq("idempotency_key", b.idempotency_key).maybeSingle();
    if (existing) return res.status(200).json(bookingView(existing, room.unit_code));
  }

  const { data: cal } = await supabase.from("room_calendar").insert({
    room_id: room.id, starts_on: b.starts_on, ends_on: b.ends_on ?? null,
    kind: "PLATFORM_BOOKING", source: channel.slug, external_ref: b.external_ref ?? null,
    status: "ACTIVE", blocks: true, auto_created: true, notes: "Partner API booking",
  }).select("id").single();

  const { data: created, error: insErr } = await supabase.from("channel_bookings").insert({
    channel_id: channel.id, room_id: room.id, external_ref: b.external_ref ?? null,
    idempotency_key: b.idempotency_key ?? null, starts_on: b.starts_on, ends_on: b.ends_on ?? null,
    guest: b.guest ?? {}, notes: b.note ?? null, calendar_id: cal?.id ?? null,
  }).select("id, starts_on, ends_on, status, external_ref, created_at").single();
  if (insErr) return err(res, 500, "internal", "Could not record the booking");

  await sendAdminEmail(bookingEmail({ channel, room, booking: created, guest: b.guest }));
  return res.status(201).json(bookingView(created, room.unit_code));
}

async function handleListBookings(res, channel, query) {
  let q = supabase.from("channel_bookings")
    .select("id, starts_on, ends_on, status, external_ref, created_at, room:rooms(unit_code)")
    .eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(100);
  const { data } = await q;
  let rows = (data ?? []).map((r) => bookingView(r, r.room?.unit_code ?? null));
  if (query.listing) rows = rows.filter((r) => r.listing_code === query.listing);
  return res.status(200).json({ data: rows });
}

async function handleGetBooking(res, channel, id) {
  const { data } = await supabase.from("channel_bookings")
    .select("id, starts_on, ends_on, status, external_ref, created_at, room:rooms(unit_code)")
    .eq("id", id).eq("channel_id", channel.id).maybeSingle();
  if (!data) return err(res, 404, "not_found", "No such booking for this key");
  return res.status(200).json(bookingView(data, data.room?.unit_code ?? null));
}

async function handleCancelBooking(res, channel, id) {
  const { data } = await supabase.from("channel_bookings")
    .select("id, starts_on, ends_on, status, external_ref, created_at, calendar_id, guest, room:rooms(unit_code, name, property:properties(name))")
    .eq("id", id).eq("channel_id", channel.id).maybeSingle();
  if (!data) return err(res, 404, "not_found", "No such booking for this key");
  if (data.status === "cancelled") return res.status(200).json(bookingView(data, data.room?.unit_code ?? null));
  const { data: updated } = await supabase.from("channel_bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id).select("id, starts_on, ends_on, status, external_ref, created_at").single();
  if (data.calendar_id)
    await supabase.from("room_calendar").update({ status: "CANCELLED" }).eq("id", data.calendar_id);
  if (data.room) await sendAdminEmail(bookingCancelledEmail({ channel, room: data.room, booking: data }));
  return res.status(200).json(bookingView(updated, data.room?.unit_code ?? null));
}

// ── Sell state: rule-18 sell-priority, straight from the DB views so the
// rule lives in one place and agents can never drift from it ─────────
async function handleSellState(res, keyRow) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Sell state needs an internal-scope key");
  const [{ data: sellable }, { data: should }] = await Promise.all([
    supabase.from("v_sellable_rooms").select("unit_code, price, frees_on, next_arrival"),
    supabase.from("v_should_be_live").select("unit_code"),
  ]);
  const shouldSet = new Set((should ?? []).map((r) => r.unit_code));
  return res.status(200).json({ data: (sellable ?? []).map((r) => sellStateView(r, shouldSet)) });
}

// ── Placements: internal-scope agents report platform listing state ──
async function handlePlacements(req, res, keyRow, channel) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Placements need an internal-scope key");
  if (req.method === "GET") {
    const { data } = await supabase.from("listing_placements")
      .select("id, status, external_id, url, last_pushed_at, last_verified_at, last_drift, last_error, observed_state, observed_at, expires_at, updated_at, room:rooms(unit_code)")
      .eq("channel_id", channel.id);
    return res.status(200).json({
      data: (data ?? []).map((p) => ({ ...p, listing_code: p.room?.unit_code ?? null, room: undefined })),
    });
  }
  if (req.method === "POST") {
    const b = req.body ?? {};
    b.listing_code = up(b.listing_code);
    if (!b.listing_code) return err(res, 422, "validation_failed", "Missing: listing_code");
    const { data: room } = await supabase.from("rooms").select("id, unit_code").eq("unit_code", b.listing_code).maybeSingle();
    if (!room) return err(res, 422, "validation_failed", "Unknown listing_code");
    let patch;
    try {
      patch = buildPlacementPatch(b, new Date().toISOString());
    } catch (e) {
      return err(res, 422, "validation_failed", String(e.message ?? e));
    }
    const { data: up, error: upErr } = await supabase.from("listing_placements")
      .upsert({ room_id: room.id, channel_id: channel.id, ...patch }, { onConflict: "room_id,channel_id" })
      .select("id, status, external_id, url, last_pushed_at, last_verified_at")
      .single();
    if (upErr) return err(res, 500, "internal", "Could not record the placement");
    return res.status(200).json({ ...up, listing_code: room.unit_code });
  }
  return err(res, 405, "method_not_allowed", "Unsupported method");
}

// ── Leads: the CRM write path ────────────────────────────────────────
//
// The rule the whole CRM hangs on is that the phone number is the person.
// Everything else (a Carousell handle, a Beeper chat id, a WhatsApp LID)
// is an alias that attaches to that row, so Utkarsh on Carousell, Utkarsh
// on the WA line and Utkarsh in a viewing row are one lead and not three.
//
// matchLead looks for the person in the order the identifiers can be
// trusted: a normalised phone is definitive, a chat id is reliable within
// one platform, and an alias is a last resort. It deliberately does NOT
// match on name: two different Jane Tans are not one prospect.
async function matchLead(body) {
  const phone = normalisePhone(body.phone);
  if (phone) {
    const { data } = await supabase.from("leads").select("*").eq("phone_e164", phone)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) return { row: data, matched_on: "phone" };
  }
  if (body.chat_id) {
    const { data } = await supabase.from("leads").select("*").eq("chat_id", String(body.chat_id))
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) return { row: data, matched_on: "chat_id" };
  }
  const aliases = [
    ...(Array.isArray(body.identifiers) ? body.identifiers : []),
    // A LID arrives in the phone field and is not a phone; it is still the
    // only handle we have for that person until they send a real number.
    ...(!phone && body.phone ? [String(body.phone)] : []),
  ].map((s) => String(s).trim()).filter(Boolean);
  if (aliases.length) {
    const { data } = await supabase.from("leads").select("*")
      .overlaps("identifiers", aliases)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) return { row: data, matched_on: "identifier" };
  }
  if (body.email) {
    const { data } = await supabase.from("leads").select("*").eq("email", body.email)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) return { row: data, matched_on: "email" };
  }
  return { row: null, matched_on: null };
}

async function handleCreateLead(req, res, keyRow, channel) {
  const b = req.body ?? {};
  const v = validateLead(b);
  if (!v.ok) return err(res, 422, "validation_failed", `Missing or invalid: ${v.missing.join(", ")}`);

  // Same idempotency contract as /bookings: a retried POST returns the row
  // it already made rather than a second copy of the same human.
  if (b.idempotency_key) {
    const { data: existing } = await supabase.from("leads").select("*")
      .eq("channel_id", channel.id).eq("idempotency_key", b.idempotency_key).maybeSingle();
    if (existing) return res.status(200).json({ ...leadView(existing), matched_on: "idempotency_key", created: false });
  }

  const { row: found, matched_on } = await matchLead(b);
  const patch = leadPatch(b, { channelId: channel.id });

  // Aliases accumulate. Losing an old handle breaks the next match, and the
  // whole point is that one person keeps one row as they move platforms.
  const incoming = [
    ...(Array.isArray(b.identifiers) ? b.identifiers : []),
    ...(!normalisePhone(b.phone) && b.phone ? [String(b.phone)] : []),
  ];
  patch.identifiers = mergeIdentifiers(found?.identifiers, incoming);

  if (found) {
    // Never downgrade a lead that has already progressed: the brain files
    // "new" on every fresh message, and letting that overwrite "signed"
    // would walk a closed deal backwards.
    if (patch.status && found.status && found.status !== "new" && patch.status === "new")
      delete patch.status;
    // A name we already have beats a platform display name like "WA User".
    if (found.name && !b.name_authoritative) delete patch.name;
    const { data: updated, error: upErr } = await supabase.from("leads")
      .update(patch).eq("id", found.id).select("*").single();
    if (upErr) return err(res, 500, "internal", "Could not update the lead");
    return res.status(200).json({ ...leadView(updated), matched_on, created: false });
  }

  const insert = {
    ...patch,
    status: patch.status ?? "new",
    source: patch.source ?? channel.slug,
    first_contact_at: b.first_contact_at ?? new Date().toISOString(),
  };
  const { data: created, error: insErr } = await supabase.from("leads")
    .insert(insert).select("*").single();
  if (insErr) return err(res, 500, "internal", "Could not record the lead");
  return res.status(201).json({ ...leadView(created), matched_on: null, created: true });
}

async function handleListLeads(res, keyRow, query) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Listing leads needs an internal-scope key");
  let q = supabase.from("leads").select("*").order("updated_at", { ascending: false }).limit(200);
  if (query.lifecycle) q = q.eq("lifecycle", String(query.lifecycle).toUpperCase());
  if (query.status) q = q.eq("status", query.status);
  if (query.phone) {
    const p = normalisePhone(query.phone);
    if (!p) return err(res, 422, "validation_failed", "phone is not a dialable number");
    q = q.eq("phone_e164", p);
  }
  const { data } = await q;
  return res.status(200).json({ data: (data ?? []).map(leadView) });
}

async function handleGetLead(res, keyRow, id) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Reading a lead needs an internal-scope key");
  const { data } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!data) return err(res, 404, "not_found", "No such lead");
  return res.status(200).json(leadView(data));
}

// ── Tickets: report to resolved, nothing dies in chat ────────────────
async function handleUpdateLead(req, res, keyRow, id) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Updating a lead needs an internal-scope key");
  const v = validateLeadUpdate(req.body);
  if (!v.ok) return err(res, 422, "validation_failed", `Invalid: ${v.missing.join(", ")}`);
  const patch = leadUpdatePatch(req.body);
  if (Object.keys(patch).length <= 1)
    return err(res, 422, "validation_failed", "Nothing to update");
  const { data: updated, error: upErr } = await supabase.from("leads")
    .update(patch).eq("id", id).select("*").single();
  if (upErr || !updated) return err(res, 404, "not_found", "No such lead");
  return res.status(200).json(leadView(updated));
}

async function handleCreateTicket(req, res, keyRow, channel) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Filing a ticket needs an internal-scope key");
  const b = req.body ?? {};
  if (b.listing_code) b.listing_code = up(b.listing_code);
  const v = validateTicket(b);
  if (!v.ok) return err(res, 422, "validation_failed", `Missing or invalid: ${v.missing.join(", ")}`);

  if (b.idempotency_key) {
    const { data: existing } = await supabase.from("maintenance_tickets")
      .select("*, room:rooms(unit_code)")
      .eq("channel_id", channel.id).eq("idempotency_key", b.idempotency_key).maybeSingle();
    if (existing) return res.status(200).json(ticketView(existing, existing.room?.unit_code ?? null));
  }

  // A room implies its property. A property alone is legitimate: a lift, a
  // corridor light and a front gate belong to a building and to no room.
  let roomId = null, propertyId = null, unitCode = null;
  if (b.listing_code) {
    const { data: room } = await supabase.from("rooms")
      .select("id, unit_code, property_id").eq("unit_code", b.listing_code).maybeSingle();
    if (!room) return err(res, 422, "validation_failed", "Unknown listing_code");
    roomId = room.id; propertyId = room.property_id; unitCode = room.unit_code;
  } else {
    const { data: prop } = await supabase.from("properties")
      .select("id").eq("slug", b.property_slug).maybeSingle();
    if (!prop) return err(res, 422, "validation_failed", "Unknown property_slug");
    propertyId = prop.id;
  }

  // Tie the ticket to the person who reported it when we already know them,
  // so a tenant's history is one thread rather than scattered rows.
  let leadId = null;
  const phone = normalisePhone(b.reporter_phone);
  if (phone) {
    const { data: lead } = await supabase.from("leads").select("id").eq("phone_e164", phone).maybeSingle();
    leadId = lead?.id ?? null;
  }

  const row = ticketInsert(b, { roomId, propertyId, channelId: channel.id, leadId });
  const { data: created, error: insErr } = await supabase.from("maintenance_tickets")
    .insert(row).select("*").single();
  if (insErr) return err(res, 500, "internal", "Could not record the ticket");

  // Urgent work is the one case where a row is not enough: somebody has to
  // be told while it still matters.
  if (created.severity === "URGENT") {
    await sendAdminEmail({
      subject: `URGENT maintenance: ${unitCode ?? b.property_slug} ${created.category}`,
      text: [
        `An urgent maintenance ticket was filed via ${channel.name}.`,
        ``,
        `Where:     ${unitCode ?? b.property_slug}`,
        `Category:  ${created.category}`,
        `Reported:  ${created.reporter_name ?? "unknown"} ${created.reporter_phone ?? ""}`.trim(),
        `Due by:    ${created.due_at}`,
        ``,
        created.description,
      ].join("\n"),
    });
  }
  return res.status(201).json(ticketView(created, unitCode));
}

async function handleListTickets(res, keyRow, query) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Listing tickets needs an internal-scope key");
  let q = supabase.from("maintenance_tickets")
    .select("*, room:rooms(unit_code)")
    .order("due_at", { ascending: true }).limit(200);
  if (query.status) q = q.eq("status", String(query.status).toUpperCase());
  if (query.severity) q = q.eq("severity", String(query.severity).toUpperCase());
  if (query.open === "true") q = q.neq("status", "RESOLVED");
  if (query.overdue === "true") q = q.neq("status", "RESOLVED").lt("due_at", new Date().toISOString());
  const { data } = await q;
  return res.status(200).json({ data: (data ?? []).map((t) => ticketView(t, t.room?.unit_code ?? null)) });
}

async function handleUpdateTicket(req, res, keyRow, id) {
  if (keyRow.scope !== "internal")
    return err(res, 403, "forbidden", "Updating a ticket needs an internal-scope key");
  const b = req.body ?? {};
  const patch = { updated_at: new Date().toISOString() };
  for (const [field, key] of [["status", "status"], ["severity", "severity"]]) {
    if (b[field] != null) patch[key] = String(b[field]).toUpperCase();
  }
  const v = validateTicket({
    description: "unchanged", property_slug: "unchanged", reporter_phone: "unchanged",
    status: patch.status, severity: patch.severity,
  });
  if (!v.ok) return err(res, 422, "validation_failed", `Invalid: ${v.missing.join(", ")}`);
  for (const f of ["resolution_note", "scheduled_for", "access_note", "assigned_to",
                   "charge_to_tenant", "charge_amount"]) {
    if (b[f] !== undefined) patch[f] = b[f];
  }
  // Closing the loop stamps the time; the photo-proof rule is enforced by
  // the caller that owns the evidence, not here.
  if (patch.status === "RESOLVED") patch.resolved_at = new Date().toISOString();
  if (b.chased) {
    patch.last_chased_at = new Date().toISOString();
    const { data: cur } = await supabase.from("maintenance_tickets").select("chase_count").eq("id", id).maybeSingle();
    patch.chase_count = (cur?.chase_count ?? 0) + 1;
  }
  const { data: updated, error: upErr } = await supabase.from("maintenance_tickets")
    .update(patch).eq("id", id).select("*, room:rooms(unit_code)").single();
  if (upErr || !updated) return err(res, 404, "not_found", "No such ticket");
  return res.status(200).json(ticketView(updated, updated.room?.unit_code ?? null));
}

// ── Webhook subscription CRUD ────────────────────────────────────────
async function handleWebhooks(req, res, channel, id) {
  if (req.method === "GET") {
    const { data } = await supabase.from("webhook_subscriptions")
      .select("id, url, events, active, created_at").eq("channel_id", channel.id).eq("active", true);
    return res.status(200).json({ data: data ?? [] });
  }
  if (req.method === "POST") {
    const { url, events } = req.body ?? {};
    if (!url || !/^https:\/\//.test(url)) return err(res, 422, "validation_failed", "url must be https");
    if (!Array.isArray(events) || events.length === 0 || !events.every((e) => EVENT_TYPES.has(e)))
      return err(res, 422, "validation_failed", `events must be a non-empty subset of: ${[...EVENT_TYPES].join(", ")}`);
    const secret = "whsec_" + randomBytes(24).toString("base64url");
    const { data } = await supabase.from("webhook_subscriptions")
      .insert({ channel_id: channel.id, url, events, secret }).select("id, url, events, created_at").single();
    return res.status(201).json({ ...data, secret });
  }
  if (req.method === "DELETE" && id) {
    await supabase.from("webhook_subscriptions").update({ active: false })
      .eq("id", id).eq("channel_id", channel.id);
    return res.status(204).end();
  }
  return err(res, 405, "method_not_allowed", "Unsupported method");
}

// ── Internal dispatch (pg_cron sweep calls this every minute) ────────
async function handleDispatch(req, res) {
  if (req.headers["x-dispatch-secret"] !== process.env.PARTNER_DISPATCH_SECRET)
    return err(res, 401, "unauthorized", "Bad dispatch secret");
  const { data: pending } = await supabase
    .from("webhook_deliveries")
    .select("id, event_type, payload, attempts, subscription:webhook_subscriptions(id, url, secret, active)")
    .eq("status", "PENDING").lte("attempts", MAX_DELIVERY_ATTEMPTS).limit(50);
  let delivered = 0, failed = 0;
  for (const d of pending ?? []) {
    if (!d.subscription?.active) {
      await supabase.from("webhook_deliveries").update({ status: "DEAD", last_error: "subscription inactive" }).eq("id", d.id);
      continue;
    }
    const body = JSON.stringify({ id: d.id, type: d.event_type, created_at: new Date().toISOString(), data: d.payload });
    try {
      const r = await fetch(d.subscription.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lazybee-Signature": signPayload(d.subscription.secret, body) },
        body, signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        await supabase.from("webhook_deliveries").update({ status: "DELIVERED", delivered_at: new Date().toISOString() }).eq("id", d.id);
        delivered++;
      } else throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      const attempts = d.attempts + 1;
      await supabase.from("webhook_deliveries").update({
        attempts, last_error: String(e).slice(0, 300),
        status: attempts >= MAX_DELIVERY_ATTEMPTS ? "DEAD" : "PENDING",
      }).eq("id", d.id);
      failed++;
    }
  }
  return res.status(200).json({ delivered, failed });
}

// ── Router ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const started = Date.now();
  // Resolve the route from req.url (req.query.path is unreliable for
  // catch-alls in non-Next Vercel functions, same finding as api/booking).
  // The platform only matches ONE segment after /api/v1, so vercel.json
  // rewrites fold deeper paths into _seg2/_seg3 query params.
  const segs = (req.url || "")
    .split("?")[0]
    .replace(/^\/api\/v1\/?/, "")
    .split("/")
    .filter(Boolean);
  if (req.query?._seg2) segs.push(req.query._seg2);
  if (req.query?._seg3) segs.push(req.query._seg3);
  const [head, second, third] = segs;

  if (req.method === "OPTIONS") return res.status(204).end();
  // Bare /api/v1 used to fall through to Vercel's HTML 404; a JSON pointer
  // is the only thing an integrating machine can use. No auth: it says
  // nothing the docs page does not.
  if (!head || head === "_index")
    return res.status(200).json({ name: "Lazybee Partner API", version: "v1", docs: "https://www.lazybee.sg/developers" });
  if (head === "internal" && second === "dispatch" && req.method === "POST")
    return handleDispatch(req, res);

  const auth = await authenticate(req);
  if (auth.error) {
    if (auth.retryAfter) res.setHeader("Retry-After", String(auth.retryAfter));
    return err(res, ...auth.error);
  }
  const { keyRow } = auth;
  const channel = keyRow.channel;

  const originalJson = res.json.bind(res);
  res.json = (payload) => { logRequest(keyRow.id, req, res.statusCode, started); return originalJson(payload); };

  try {
    if (head === "ping" && req.method === "GET")
      return res.status(200).json({ ok: true, partner: channel.name, version: "v1" });
    if (head === "properties" && req.method === "GET")
      return handleProperties(res, second ?? null);
    if (head === "listings" && req.method === "GET" && third === "calendar")
      return handleCalendar(res, up(second));
    if (head === "listings" && req.method === "GET")
      return handleListings(res, channel, req.query, second ? up(second) : null);
    if (head === "booking-requests" && req.method === "POST" && !second)
      return handleCreateBookingRequest(req, res, channel);
    if (head === "booking-requests" && req.method === "GET" && second)
      return handleGetBookingRequest(res, channel, second);
    if (head === "bookings" && req.method === "POST" && !second)
      return handleCreateBooking(req, res, channel);
    if (head === "bookings" && req.method === "GET" && !second)
      return handleListBookings(res, channel, req.query);
    if (head === "bookings" && req.method === "GET" && second)
      return handleGetBooking(res, channel, second);
    if (head === "bookings" && req.method === "POST" && second && third === "cancel")
      return handleCancelBooking(res, channel, second);
    if (head === "internal" && second === "sell-state" && req.method === "GET")
      return handleSellState(res, keyRow);
    // Leads. POST is open to partner scope so a referral carries attribution;
    // reading the book stays internal, because one partner has no business
    // browsing another's prospects.
    if (head === "leads" && req.method === "POST" && !second)
      return handleCreateLead(req, res, keyRow, channel);
    if (head === "leads" && req.method === "GET" && !second)
      return handleListLeads(res, keyRow, req.query);
    if (head === "leads" && (req.method === "PATCH" || req.method === "POST") && second)
      return await handleUpdateLead(req, res, keyRow, second);
    if (head === "leads" && req.method === "GET" && second)
      return handleGetLead(res, keyRow, second);
    if (head === "tickets" && req.method === "POST" && !second)
      return handleCreateTicket(req, res, keyRow, channel);
    if (head === "tickets" && req.method === "GET" && !second)
      return handleListTickets(res, keyRow, req.query);
    if (head === "tickets" && (req.method === "PATCH" || req.method === "POST") && second)
      return handleUpdateTicket(req, res, keyRow, second);
    if (head === "placements")
      return handlePlacements(req, res, keyRow, channel);
    if (head === "webhooks")
      return handleWebhooks(req, res, channel, second ?? null);
    return err(res, 404, "not_found", "Unknown route; see https://lazybee.sg/developers");
  } catch (e) {
    console.error("partner api error:", e);
    return err(res, 500, "internal", "Something went wrong on our side");
  }
}
