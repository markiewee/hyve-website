// /api/cron/viewing-reminders
// Daily Vercel cron at 12:00 UTC = 8pm SGT — sends "next-day" reminder emails
// for confirmed viewings happening 12-36h out. (2h reminder disabled on Hobby
// plan since cron limited to once-per-day. Re-enable when on Pro: schedule
// `0 * * * *` and uncomment sweep2h.)
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
  // Daily cron — broadened window (12-36h) to catch all next-day viewings
  // since we only fire once per day. Idempotency comes from reminder_24h_sent_at
  // so re-runs do not duplicate.
  const now = Date.now();
  const lo = new Date(now + 12 * 60 * 60 * 1000).toISOString();
  const hi = new Date(now + 36 * 60 * 60 * 1000).toISOString();

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
    // 2h reminder disabled — Hobby plan cron is daily only, can't fire 2h
    // sweep accurately. Manually invoke this endpoint with ?secret=... to
    // force a 2h sweep, or upgrade Vercel plan + re-enable.
    const r24 = await sweep24h();
    const r2 = req.query?.include_2h ? await sweep2h() : { skipped: "daily-cron" };
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
