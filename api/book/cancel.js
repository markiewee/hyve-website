// /api/book/cancel?token=...
//
//   GET  → returns viewing details for the cancel confirm page (no auth, token-gated)
//   POST → cancels the viewing, cancels the cal event, fires cancellation emails

import { createClient } from "@supabase/supabase-js";
import { cancelEvent } from "../../src/lib/googleCalendar.js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = req.query?.token;
  if (!token || typeof token !== "string" || token.length < 16) {
    return res.status(400).json({ error: "Invalid token" });
  }

  // Fetch viewing
  const { data: viewing, error: fetchErr } = await supabase
    .from("property_viewings")
    .select(
      "id, status, slot_start, slot_end, prospect_name, prospect_email, prospect_phone, gcal_event_id, source, properties(name, code, address), rooms(name, unit_code)"
    )
    .eq("cancel_token", token)
    .maybeSingle();

  if (fetchErr) {
    console.error("[book/cancel] fetch error:", fetchErr);
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

  // Update DB
  const { error: updErr } = await supabase
    .from("property_viewings")
    .update({ status: "cancelled" })
    .eq("id", viewing.id);
  if (updErr) {
    console.error("[book/cancel] update error:", updErr);
    return res.status(500).json({ error: "Cancel failed" });
  }

  // Update related lead back to 'new' if it pointed at this viewing
  await supabase
    .from("leads")
    .update({ status: "new", viewing_id: null })
    .eq("viewing_id", viewing.id);

  // Cancel Google Cal event (best-effort)
  if (viewing.gcal_event_id) {
    try {
      await cancelEvent(viewing.gcal_event_id);
    } catch (err) {
      console.error("[book/cancel] gcal cancel non-fatal:", err);
    }
  }

  // Fire cancellation emails
  Promise.allSettled([fireNotify("viewing-cancelled", viewing.id)]).catch(() => {});

  return res.status(200).json({ success: true });
}
