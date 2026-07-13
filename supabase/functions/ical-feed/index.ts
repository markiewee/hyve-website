// ical-feed — public iCalendar (.ics) feed per Lazybee room, for Airbnb calendar sync.
//
// Airbnb ("Connect to another website", Step 2) imports a public .ics URL and blocks
// the dates it lists. We serve one feed per room built LIVE from hyve-iot tenant_profiles.
// Each active tenancy becomes an all-day busy VEVENT whose checkout (DTEND) is the
// tenant's lease_end MINUS 10 days — so Airbnb auto-reopens the room 10 days early
// (Mark's rule). Change lease_end in the DB and Airbnb updates within its 1-4h poll.
//
// One-way: Lazybee -> Airbnb. Airbnb's own bookings are separately synced back via
// the tenant_profiles rows we already create for them (e.g. "*-airbnb").
//
// Auth: public (deploy with --no-verify-jwt). The URL carries a per-room token =
// HMAC-SHA256(unit_code, ICAL_SECRET) so the feed can't be guessed and each URL
// only exposes one room's dates (never any tenant name).
//
// URL shape (ends in .ics, no query string, Airbnb-friendly):
//   https://<ref>.supabase.co/functions/v1/ical-feed/<TOKEN>/<UNIT_CODE>.ics

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EARLY_RELEASE_DAYS = 10; // reopen the room this many days before lease_end
const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function tokenFor(unitCode: string): Promise<string> {
  const secret = Deno.env.get("ICAL_SECRET") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(unitCode.toUpperCase()));
  return hex(sig).slice(0, 20);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Format a Date as an all-day iCal DATE value (YYYYMMDD) in UTC.
function icalDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function parseDateUTC(s: string): Date {
  // Accept 'YYYY-MM-DD' or a full timestamp; treat as calendar date (UTC midnight).
  return new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  // Path after the function name: /functions/v1/ical-feed/<token>/<UNIT>.ics
  const parts = url.pathname.split("/").filter(Boolean);
  const fnIdx = parts.indexOf("ical-feed");
  const tail = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;

  // Support both /<token>/<UNIT>.ics and ?token=&room= fallbacks.
  let token = tail[0] ?? url.searchParams.get("token") ?? "";
  let roomRaw = tail[1] ?? url.searchParams.get("room") ?? "";
  if (tail.length === 1 && (tail[0].endsWith(".ics") || url.searchParams.get("room"))) {
    // /<UNIT>.ics?token=... shape
    roomRaw = tail[0];
    token = url.searchParams.get("token") ?? token;
  }

  const unitCode = decodeURIComponent(roomRaw).replace(/\.ics$/i, "").toUpperCase();
  if (!unitCode) return new Response("room required", { status: 400 });

  const expected = await tokenFor(unitCode);
  if (!token || !timingSafeEqual(token, expected)) {
    return new Response("Not found", { status: 404 });
  }

  // Resolve the room, then its active tenancies with a lease_end.
  const { data: room, error: rErr } = await supabase
    .from("rooms")
    .select("id, unit_code")
    .ilike("unit_code", unitCode)
    .maybeSingle();
  if (rErr) return new Response("db error", { status: 500 });
  if (!room) return new Response("Not found", { status: 404 });

  const { data: tenancies, error: tErr } = await supabase
    .from("tenant_profiles")
    .select("id, moved_in_at, lease_end")
    .eq("room_id", room.id)
    .eq("is_active", true)
    .not("lease_end", "is", null);
  if (tErr) return new Response("db error", { status: 500 });

  const today = parseDateUTC(new Date().toISOString());
  const stamp = icalDate(today) + "T000000Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lazybee//Room Availability//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Lazybee ${room.unit_code}`,
  ];

  const seen = new Set<string>(); // dedupe identical blocks (e.g. a couple on one lease)
  for (const t of tenancies ?? []) {
    if (!t.lease_end) continue;
    // Block ends (room reopens) 10 days before lease_end. DTEND is checkout-exclusive.
    let dtEnd = addDays(parseDateUTC(t.lease_end), -EARLY_RELEASE_DAYS);
    // Start of the block: move-in, clamped to today so we don't emit long past ranges.
    let dtStart = t.moved_in_at ? parseDateUTC(t.moved_in_at) : today;
    if (dtStart < today) dtStart = today;
    // Nothing to block if the reopen date is already here / passed.
    if (dtEnd <= dtStart) continue;

    const key = `${icalDate(dtStart)}-${icalDate(dtEnd)}`;
    if (seen.has(key)) continue; // same interval already blocked (shared lease)
    seen.add(key);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${room.unit_code}-${t.id}@lazybee.sg`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icalDate(dtStart)}`,
      `DTEND;VALUE=DATE:${icalDate(dtEnd)}`,
      "SUMMARY:Not available",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n") + "\r\n";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${room.unit_code}.ics"`,
      "Cache-Control": "public, max-age=1800",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
