// POST /api/book/create
// Public — creates a viewing booking.
// Body:
//   { property, room?, slot_start, name, email, phone, source?, notes? }
//
// Flow:
//   1. Validate inputs
//   2. Look up property + room
//   3. Re-check slot still free (Google Cal free/busy + DB row check)
//   4. Generate cancel_token
//   5. Insert property_viewings (status='confirmed')
//   6. Upsert leads row, link viewing_id
//   7. Create Google Calendar event
//   8. Update viewing row with gcal_event_id
//   9. Trigger viewing-notify edge function with new event types
//  10. Return { success, viewing_id, cancel_url }

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
import { isSlotStillFree, createEvent } from "../../src/lib/googleCalendar.js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const SLOT_MINUTES = 30;

function addMinutesIso(iso, mins) {
  const ms = new Date(iso).getTime() + mins * 60 * 1000;
  // Preserve the +08:00 offset when present
  const offset = (iso.match(/([+-]\d{2}:?\d{2}|Z)$/) || [])[0] || "+08:00";
  const d = new Date(ms);
  // Build a string in that offset
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
  const yyyy = local.getUTCFullYear();
  const mm = pad(local.getUTCMonth() + 1);
  const dd = pad(local.getUTCDate());
  const hh = pad(local.getUTCHours());
  const mi = pad(local.getUTCMinutes());
  const ss = pad(local.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${offset}`;
}

async function fireNotify(event, viewingId) {
  const url = `${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/viewing-notify`;
  try {
    const r = await fetch(url, {
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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const propertyCode = normalizePropertyCode(body.property);
    const roomCode = body.room ? String(body.room).trim() : null;
    const slotStart = body.slot_start;
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase() || null;
    const phone = normalizePhone(body.phone);
    const source = normalizeSource(body.source);
    const notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;

    // ── Validate ─────────────────────────────────────────────────────
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
    const slotStartMs = new Date(slotStart).getTime();
    if (Number.isNaN(slotStartMs)) {
      return res.status(400).json({ error: "invalid slot_start" });
    }

    // ── Property lookup ──────────────────────────────────────────────
    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("id, name, code, address")
      .eq("code", propertyCode)
      .maybeSingle();
    if (propErr) {
      console.error("[book/create] property lookup error:", propErr);
      return res.status(500).json({ error: "Property lookup failed" });
    }
    if (!property) {
      return res.status(404).json({ error: `Unknown property '${propertyCode}'` });
    }

    // ── Room lookup (optional) ───────────────────────────────────────
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

    // ── Race-guard: DB check for any non-cancelled viewing in this slot
    const { data: existingDb, error: existingErr } = await supabase
      .from("property_viewings")
      .select("id")
      .eq("property_id", property.id)
      .eq("slot_start", slotStart)
      .neq("status", "cancelled")
      .limit(1);
    if (existingErr) {
      console.error("[book/create] existing check error:", existingErr);
      return res.status(500).json({ error: "Slot lookup failed" });
    }
    if (existingDb && existingDb.length > 0) {
      return res.status(409).json({ error: "Slot just got booked, please pick another." });
    }

    // ── Race-guard: Google Cal free/busy check ──────────────────────
    let stillFree = true;
    try {
      stillFree = await isSlotStillFree(slotStart, slotEnd);
    } catch (err) {
      // If Cal API fails, fail safe: refuse the booking rather than risk a double-book
      console.error("[book/create] freebusy check failed:", err);
      return res.status(503).json({
        error: "Calendar service unavailable, please try again in a moment.",
      });
    }
    if (!stillFree) {
      return res.status(409).json({ error: "Slot just got booked, please pick another." });
    }

    // ── Insert viewing row ──────────────────────────────────────────
    const cancelToken = generateCancelToken();
    const viewingDate = slotStart.slice(0, 10); // YYYY-MM-DD (SGT)
    const viewingTime = slotStart.slice(11, 19); // HH:MM:SS

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
      console.error("[book/create] insert error:", insErr);
      return res.status(500).json({ error: "Failed to save viewing" });
    }
    const viewingId = inserted.id;

    // ── Upsert lead row ─────────────────────────────────────────────
    try {
      let existingLead = null;
      if (email) {
        const { data } = await supabase
          .from("leads")
          .select("id, property_interest")
          .eq("email", email)
          .maybeSingle();
        existingLead = data;
      }
      if (!existingLead && phone) {
        const { data } = await supabase
          .from("leads")
          .select("id, property_interest")
          .eq("phone", phone)
          .maybeSingle();
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
      // Lead upsert failures shouldn't break the booking — log and continue
      console.error("[book/create] lead upsert non-fatal error:", err);
    }

    // ── Create Google Calendar event ────────────────────────────────
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
      ]
        .filter(Boolean)
        .join("\n");

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
      // If cal event fails, mark viewing for manual reconciliation but don't block.
      // The slot is held in DB; admin can sort it out.
      console.error("[book/create] gcal createEvent failed:", err);
    }

    // ── Fire emails (don't block the response) ──────────────────────
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
  } catch (err) {
    console.error("[/api/book/create] fatal:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
