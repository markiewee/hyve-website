// /api/cron/viewing-reminders
// Hourly Vercel cron — sends 24h and 2h reminder emails for confirmed viewings.
//
// Protected via Authorization: Bearer <CRON_SECRET> header (Vercel Cron sends
// the value of CRON_SECRET as the Authorization header automatically when
// configured in vercel.json + env, but we also accept ?secret=... for manual
// runs).

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev-mode (cron disabled), allow
  const header = req.headers.authorization || "";
  if (header === `Bearer ${secret}`) return true;
  if (req.query?.secret === secret) return true;
  return false;
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
      throw new Error(`viewing-notify ${r.status}: ${text.slice(0, 300)}`);
    }
    return await r.json().catch(() => ({}));
  } catch (err) {
    console.error(`[cron-reminders ${event}] ${viewingId} failed:`, err.message);
    return { error: err.message };
  }
}

async function sweep24h() {
  const now = Date.now();
  const lo = new Date(now + 23 * 60 * 60 * 1000).toISOString();
  const hi = new Date(now + 25 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("property_viewings")
    .select("id")
    .eq("status", "confirmed")
    .is("reminder_24h_sent_at", null)
    .gte("slot_start", lo)
    .lte("slot_start", hi);

  if (error) throw error;
  if (!data || data.length === 0) return { count: 0 };

  const results = [];
  for (const v of data) {
    const r = await fireNotify("viewing-reminder-24h", v.id);
    results.push({ id: v.id, ...r });
  }
  return { count: data.length, results };
}

async function sweep2h() {
  const now = Date.now();
  const lo = new Date(now + 1.5 * 60 * 60 * 1000).toISOString();
  const hi = new Date(now + 2.5 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("property_viewings")
    .select("id")
    .eq("status", "confirmed")
    .is("reminder_2h_sent_at", null)
    .gte("slot_start", lo)
    .lte("slot_start", hi);

  if (error) throw error;
  if (!data || data.length === 0) return { count: 0 };

  const results = [];
  for (const v of data) {
    const r = await fireNotify("viewing-reminder-2h", v.id);
    results.push({ id: v.id, ...r });
  }
  return { count: data.length, results };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!authorized(req)) return res.status(403).json({ error: "Forbidden" });

  try {
    const [r24, r2] = await Promise.all([sweep24h(), sweep2h()]);
    return res.status(200).json({
      ok: true,
      ts: new Date().toISOString(),
      reminder_24h: r24,
      reminder_2h: r2,
    });
  } catch (err) {
    console.error("[cron viewing-reminders] failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
