// supabase/functions/viewing-notify/index.ts
//
// Event-driven viewing notifications for Hyve Booking V2.
//
// Invocation:
//   POST { event: <event-type>, viewing_id: <uuid> }
//
// Supported events:
//   - viewing-confirmation       → prospect (with .ics + cancel link)
//   - viewing-captain-notify     → captain
//   - viewing-admin-notify       → admin@hyve.sg / mark@meetmillia.com
//   - viewing-reminder-24h       → prospect
//   - viewing-reminder-2h        → prospect (door code, mailbox, captain phone, parking)
//   - viewing-cancelled          → prospect + captain + admin
//
// Legacy:
//   - If body has no `event`, falls back to the old "new viewing" captain+admin
//     email (V1 behaviour). This stays alive until the V1 frontend is fully retired.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SENDER = "Hyve Co-living <hello@lazybee.sg>";
const ADMIN_EMAIL = Deno.env.get("HYVE_ADMIN_EMAIL") || "admin@hyve.sg";
const ADMIN_CC = Deno.env.get("HYVE_ADMIN_CC") || "mark@meetmillia.com";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://hyve.sg";

// ── Resend helper ─────────────────────────────────────────────────────
async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string; content_type?: string }>;
  cc?: string[];
}) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const body: Record<string, unknown> = {
    from: SENDER,
    reply_to: "hello@lazybee.sg",
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.cc && opts.cc.length) body.cc = opts.cc;
  if (opts.attachments && opts.attachments.length) body.attachments = opts.attachments;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`resend ${r.status}: ${text.slice(0, 500)}`);
  return text;
}

// ── Date / time helpers (Asia/Singapore) ──────────────────────────────
const TZ = "Asia/Singapore";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
}

function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

// .ics generation (no extra deps)
function toIcsDateUtc(iso: string): string {
  // RFC5545 UTC: 20260510T030000Z
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string): string {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildIcs(args: {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description: string;
  location: string;
  status?: "CONFIRMED" | "CANCELLED";
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hyve Co-living//Viewing//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:" + (args.status === "CANCELLED" ? "CANCEL" : "REQUEST"),
    "BEGIN:VEVENT",
    `UID:${args.uid}@hyve.sg`,
    `DTSTAMP:${toIcsDateUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsDateUtc(args.start)}`,
    `DTEND:${toIcsDateUtc(args.end)}`,
    `SUMMARY:${escapeIcs(args.summary)}`,
    `DESCRIPTION:${escapeIcs(args.description)}`,
    `LOCATION:${escapeIcs(args.location)}`,
    `STATUS:${args.status || "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function b64(s: string): string {
  // btoa supports utf-8 only via TextEncoder roundtrip
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Branded HTML shell ────────────────────────────────────────────────
function shell(args: { title: string; preheader?: string; bodyHtml: string }): string {
  const pre = args.preheader || "";
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#f5f7fa;padding:16px 0;">
    <div style="display:none;font-size:1px;color:#f5f7fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(pre)}</div>
    <div style="background:#006b5f;padding:32px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:800;">${escapeHtml(args.title)}</h1>
    </div>
    <div style="padding:32px;background:white;border-radius:0 0 12px 12px;">
      ${args.bodyHtml}
      <p style="font-size:12px;color:#bbcac6;margin-top:32px;">— Hyve Co-living · <a href="${PUBLIC_SITE_URL}" style="color:#bbcac6;">hyve.sg</a></p>
    </div>
  </div>`;
}

function detailsTable(rows: Array<[string, string]>): string {
  const tr = rows
    .filter(([, v]) => v && v.length)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#6c7a77;font-weight:700;">${escapeHtml(k)}:</td><td style="padding:8px 0;">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  return `<div style="background:#f8f9ff;border-radius:12px;padding:24px;margin:24px 0;"><table style="width:100%;font-size:14px;color:#121c2a;">${tr}</table></div>`;
}

// ── Lookup helpers ────────────────────────────────────────────────────
async function loadViewing(viewing_id: string) {
  const { data, error } = await supabase
    .from("property_viewings")
    .select(
      "*, properties(name, code, address), rooms(name, unit_code, security_instructions, access_code)"
    )
    .eq("id", viewing_id)
    .single();
  if (error || !data) throw new Error("Viewing not found");
  return data;
}

async function loadCaptain(captain_id: string | null): Promise<{ email: string | null; name: string; phone: string | null }> {
  if (!captain_id) return { email: null, name: "House Captain", phone: null };
  const { data: captain } = await supabase
    .from("tenant_profiles")
    .select("user_id, tenant_details(full_name, email, phone)")
    .eq("id", captain_id)
    .single();
  let email = captain?.tenant_details?.email || null;
  const name = captain?.tenant_details?.full_name || "House Captain";
  const phone = captain?.tenant_details?.phone || null;
  if (!email && captain?.user_id) {
    const { data: userData } = await supabase.auth.admin.getUserById(captain.user_id);
    email = userData?.user?.email || null;
  }
  return { email, name, phone };
}

// ── Templates ─────────────────────────────────────────────────────────

function tplConfirmation(args: {
  viewing: any;
  captain: { name: string; phone: string | null };
  cancelUrl: string;
}) {
  const { viewing, captain, cancelUrl } = args;
  const slotIso = viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;
  const slotEndIso = viewing.slot_end || slotIso;
  const propertyName = viewing.properties?.name || "Hyve property";
  const propertyAddress = viewing.properties?.address || "";
  const propertyCode = viewing.properties?.code || "";
  const roomName = viewing.rooms?.name || viewing.rooms?.unit_code || "any available room";

  const html = shell({
    title: "Viewing confirmed",
    preheader: `${propertyName} on ${fmtDateTime(slotIso)}`,
    bodyHtml: `
      <p style="font-size:16px;color:#121c2a;">Hi ${escapeHtml(viewing.prospect_name || "there")},</p>
      <p style="font-size:15px;color:#3c4947;">Your viewing is locked in. Looking forward to showing you around.</p>
      ${detailsTable([
        ["When", fmtDateTime(slotIso)],
        ["Property", `${propertyName}${propertyCode ? ` (${propertyCode})` : ""}`],
        ["Address", propertyAddress],
        ["Room", roomName],
        ["House captain", captain.name + (captain.phone ? ` — ${captain.phone}` : "")],
      ])}
      <p style="font-size:14px;color:#3c4947;">A calendar invite is attached. We'll send a reminder 24 hours and 2 hours before with the door code and meeting point.</p>
      <p style="font-size:14px;color:#3c4947;margin-top:24px;">
        Need to cancel? <a href="${cancelUrl}" style="color:#006b5f;">Cancel this viewing</a>.
      </p>
    `,
  });

  const ics = buildIcs({
    uid: viewing.id,
    start: slotIso,
    end: slotEndIso,
    summary: `Hyve viewing — ${propertyName}`,
    description: `Hyve room viewing.\nProperty: ${propertyName}\nRoom: ${roomName}\nCaptain: ${captain.name}${captain.phone ? " " + captain.phone : ""}\n\nCancel: ${cancelUrl}`,
    location: propertyAddress || propertyName,
    status: "CONFIRMED",
  });

  return {
    subject: `Viewing confirmed — ${propertyName} · ${fmtDateTime(slotIso)}`,
    html,
    attachments: [
      { filename: "viewing.ics", content: b64(ics), content_type: "text/calendar; charset=utf-8; method=REQUEST" },
    ],
  };
}

function tplCaptainNotify(args: { viewing: any; captainName: string }) {
  const { viewing, captainName } = args;
  const slotIso = viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;
  const propertyName = viewing.properties?.name || "your property";
  const roomName = viewing.rooms?.name || viewing.rooms?.unit_code || "any available";
  const html = shell({
    title: "New viewing booked",
    preheader: `${viewing.prospect_name} at ${propertyName} on ${fmtDateTime(slotIso)}`,
    bodyHtml: `
      <p style="font-size:16px;color:#121c2a;">Hi ${escapeHtml(captainName)},</p>
      <p style="font-size:15px;color:#3c4947;">A prospect just booked a viewing — please be there.</p>
      ${detailsTable([
        ["When", fmtDateTime(slotIso)],
        ["Property", propertyName],
        ["Room", roomName],
        ["Prospect", viewing.prospect_name || "—"],
        ["Email", viewing.prospect_email || "—"],
        ["Phone", viewing.prospect_phone || "—"],
        ["Source", viewing.source || "—"],
        ["Notes", viewing.special_notes || "—"],
      ])}
      <p style="font-size:13px;color:#6c7a77;">Manage in your portal: <a href="${PUBLIC_SITE_URL}/portal/viewings" style="color:#006b5f;">${PUBLIC_SITE_URL}/portal/viewings</a></p>
    `,
  });
  return {
    subject: `New viewing: ${viewing.prospect_name} · ${propertyName} · ${fmtDateTime(slotIso)}`,
    html,
  };
}

function tplAdminNotify(args: { viewing: any }) {
  const { viewing } = args;
  const slotIso = viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;
  const propertyName = viewing.properties?.name || "—";
  const propertyCode = viewing.properties?.code || "";
  const roomName = viewing.rooms?.name || viewing.rooms?.unit_code || "(flexible)";
  const html = shell({
    title: "Viewing booked",
    bodyHtml: `
      ${detailsTable([
        ["When", fmtDateTime(slotIso)],
        ["Property", `${propertyName} (${propertyCode})`],
        ["Room", roomName],
        ["Prospect", viewing.prospect_name || "—"],
        ["Contact", `${viewing.prospect_email || "—"} / ${viewing.prospect_phone || "—"}`],
        ["Source", viewing.source || "—"],
      ])}
      <p style="font-size:13px;color:#6c7a77;">View in admin: <a href="${PUBLIC_SITE_URL}/portal/admin/viewings" style="color:#006b5f;">${PUBLIC_SITE_URL}/portal/admin/viewings</a></p>
    `,
  });
  return {
    subject: `[Hyve] Viewing: ${viewing.prospect_name} · ${propertyCode} · ${fmtDateTime(slotIso)}`,
    html,
  };
}

function tplReminder24h(args: { viewing: any; cancelUrl: string }) {
  const { viewing, cancelUrl } = args;
  const slotIso = viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;
  const propertyName = viewing.properties?.name || "Hyve";
  const propertyAddress = viewing.properties?.address || "";
  const html = shell({
    title: "Reminder — viewing tomorrow",
    preheader: `${propertyName} on ${fmtDateTime(slotIso)}`,
    bodyHtml: `
      <p style="font-size:16px;color:#121c2a;">Hi ${escapeHtml(viewing.prospect_name || "there")},</p>
      <p style="font-size:15px;color:#3c4947;">Quick reminder — your Hyve viewing is in about 24 hours.</p>
      ${detailsTable([
        ["When", fmtDateTime(slotIso)],
        ["Property", propertyName],
        ["Address", propertyAddress],
      ])}
      <p style="font-size:14px;color:#3c4947;">Still good to come?</p>
      <p style="font-size:14px;color:#3c4947;margin-top:16px;">If something came up, no stress — just <a href="${cancelUrl}" style="color:#006b5f;">cancel here</a> so we can free up the slot.</p>
      <p style="font-size:13px;color:#6c7a77;margin-top:24px;">We'll send a 2-hour reminder closer to the time with door code + meeting point.</p>
    `,
  });
  return { subject: `Tomorrow: viewing at ${propertyName}`, html };
}

function tplReminder2h(args: { viewing: any; captain: { name: string; phone: string | null } }) {
  const { viewing, captain } = args;
  const slotIso = viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;
  const propertyName = viewing.properties?.name || "Hyve";
  const propertyAddress = viewing.properties?.address || "";
  const accessCode = viewing.access_code || viewing.rooms?.access_code || null;
  const securityInstructions =
    viewing.security_instructions || viewing.rooms?.security_instructions || null;

  const html = shell({
    title: "See you in ~2 hours",
    preheader: `${propertyName} at ${fmtTime(slotIso)}`,
    bodyHtml: `
      <p style="font-size:16px;color:#121c2a;">Hi ${escapeHtml(viewing.prospect_name || "there")},</p>
      <p style="font-size:15px;color:#3c4947;">Your viewing is coming up at <strong>${escapeHtml(fmtTime(slotIso))}</strong>. Here's everything you need to get in:</p>
      ${detailsTable([
        ["Address", propertyAddress],
        ["Door code", accessCode || "Captain will let you in"],
        ["Captain", captain.name + (captain.phone ? ` — ${captain.phone}` : "")],
        ["Mailbox / parking", securityInstructions || "—"],
      ])}
      <p style="font-size:14px;color:#3c4947;">If you're running late, message the captain directly. See you soon.</p>
    `,
  });
  return { subject: `In ~2h: viewing at ${propertyName}`, html };
}

function tplCancelled(args: { viewing: any; recipientType: "prospect" | "captain" | "admin"; cancelUrl: string }) {
  const { viewing, recipientType } = args;
  const slotIso = viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;
  const slotEndIso = viewing.slot_end || slotIso;
  const propertyName = viewing.properties?.name || "Hyve";
  const propertyCode = viewing.properties?.code || "";
  const roomName = viewing.rooms?.name || viewing.rooms?.unit_code || "(flexible)";

  let body: string;
  if (recipientType === "prospect") {
    body = `
      <p style="font-size:16px;color:#121c2a;">Hi ${escapeHtml(viewing.prospect_name || "there")},</p>
      <p style="font-size:15px;color:#3c4947;">Your viewing has been cancelled. No worries — when you're ready, you can <a href="${PUBLIC_SITE_URL}/book" style="color:#006b5f;">book a new slot</a>.</p>
      ${detailsTable([
        ["Was", fmtDateTime(slotIso)],
        ["Property", propertyName],
      ])}
    `;
  } else if (recipientType === "captain") {
    body = `
      <p style="font-size:15px;color:#3c4947;">A viewing at your property was cancelled.</p>
      ${detailsTable([
        ["Was", fmtDateTime(slotIso)],
        ["Property", propertyName],
        ["Room", roomName],
        ["Prospect", viewing.prospect_name || "—"],
      ])}
      <p style="font-size:13px;color:#6c7a77;">No action needed — the slot is freed up automatically.</p>
    `;
  } else {
    body = `
      ${detailsTable([
        ["Cancelled", fmtDateTime(slotIso)],
        ["Property", `${propertyName} (${propertyCode})`],
        ["Room", roomName],
        ["Prospect", viewing.prospect_name || "—"],
        ["Contact", `${viewing.prospect_email || "—"} / ${viewing.prospect_phone || "—"}`],
      ])}
    `;
  }

  const html = shell({ title: "Viewing cancelled", bodyHtml: body });

  // .ics CANCEL for prospect (helps remove the event from their cal)
  const attachments =
    recipientType === "prospect"
      ? [
          {
            filename: "viewing-cancelled.ics",
            content: b64(
              buildIcs({
                uid: viewing.id,
                start: slotIso,
                end: slotEndIso,
                summary: `Hyve viewing — ${propertyName}`,
                description: "Cancelled.",
                location: viewing.properties?.address || propertyName,
                status: "CANCELLED",
              })
            ),
            content_type: "text/calendar; charset=utf-8; method=CANCEL",
          },
        ]
      : undefined;

  return {
    subject: `Viewing cancelled — ${propertyName} · ${fmtDateTime(slotIso)}`,
    html,
    attachments,
  };
}

// ── Legacy fallback (V1 captain notify) ───────────────────────────────
async function legacyCaptainNotify(viewing: any) {
  const captain = await loadCaptain(viewing.captain_id);
  const propertyName = viewing.properties?.name || "Property";
  const roomName = viewing.rooms?.name || viewing.rooms?.unit_code || "Any available room";
  const slotIso = viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;

  const html = shell({
    title: "New Viewing Request",
    bodyHtml: `
      <p style="font-size:16px;color:#121c2a;">Hi ${escapeHtml(captain.name)},</p>
      <p style="font-size:15px;color:#3c4947;">A prospect has booked a viewing at your property.</p>
      ${detailsTable([
        ["When", fmtDateTime(slotIso)],
        ["Property", propertyName],
        ["Room", roomName],
        ["Prospect", viewing.prospect_name || "—"],
      ])}
      <p style="font-size:13px;color:#6c7a77;">Manage in <a href="${PUBLIC_SITE_URL}/portal/viewings" style="color:#006b5f;">your portal</a>.</p>
    `,
  });
  const subject = `New Viewing: ${viewing.prospect_name} at ${propertyName} — ${fmtDate(slotIso)}`;
  if (captain.email) await sendEmail({ to: captain.email, subject, html });
  await sendEmail({ to: ADMIN_EMAIL, subject, html });
  return { sent: true, captain_email: captain.email, admin_email: ADMIN_EMAIL };
}

// ── Dispatcher ────────────────────────────────────────────────────────
async function dispatch(event: string, viewing_id: string) {
  const viewing = await loadViewing(viewing_id);
  const captain = await loadCaptain(viewing.captain_id);
  const cancelUrl = viewing.cancel_token
    ? `${PUBLIC_SITE_URL}/book/cancel?token=${encodeURIComponent(viewing.cancel_token)}`
    : `${PUBLIC_SITE_URL}/book`;

  switch (event) {
    case "viewing-confirmation": {
      if (!viewing.prospect_email) return { skipped: "no prospect email" };
      const t = tplConfirmation({ viewing, captain, cancelUrl });
      await sendEmail({ to: viewing.prospect_email, subject: t.subject, html: t.html, attachments: t.attachments });
      return { sent: true, to: viewing.prospect_email };
    }
    case "viewing-captain-notify": {
      if (!captain.email) return { skipped: "no captain email" };
      const t = tplCaptainNotify({ viewing, captainName: captain.name });
      await sendEmail({ to: captain.email, subject: t.subject, html: t.html });
      return { sent: true, to: captain.email };
    }
    case "viewing-admin-notify": {
      const t = tplAdminNotify({ viewing });
      await sendEmail({ to: ADMIN_EMAIL, subject: t.subject, html: t.html, cc: [ADMIN_CC] });
      return { sent: true, to: ADMIN_EMAIL };
    }
    case "viewing-reminder-24h": {
      if (!viewing.prospect_email) return { skipped: "no prospect email" };
      const t = tplReminder24h({ viewing, cancelUrl });
      await sendEmail({ to: viewing.prospect_email, subject: t.subject, html: t.html });
      // mark as sent
      await supabase
        .from("property_viewings")
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq("id", viewing.id);
      return { sent: true, to: viewing.prospect_email };
    }
    case "viewing-reminder-2h": {
      if (!viewing.prospect_email) return { skipped: "no prospect email" };
      const t = tplReminder2h({ viewing, captain });
      await sendEmail({ to: viewing.prospect_email, subject: t.subject, html: t.html });
      await supabase
        .from("property_viewings")
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq("id", viewing.id);
      return { sent: true, to: viewing.prospect_email };
    }
    case "viewing-cancelled": {
      const out: Record<string, unknown> = {};
      if (viewing.prospect_email) {
        const t = tplCancelled({ viewing, recipientType: "prospect", cancelUrl });
        await sendEmail({ to: viewing.prospect_email, subject: t.subject, html: t.html, attachments: t.attachments });
        out.prospect = viewing.prospect_email;
      }
      if (captain.email) {
        const t = tplCancelled({ viewing, recipientType: "captain", cancelUrl });
        await sendEmail({ to: captain.email, subject: t.subject, html: t.html });
        out.captain = captain.email;
      }
      const t = tplCancelled({ viewing, recipientType: "admin", cancelUrl });
      await sendEmail({ to: ADMIN_EMAIL, subject: t.subject, html: t.html, cc: [ADMIN_CC] });
      out.admin = ADMIN_EMAIL;
      return { sent: true, ...out };
    }
    default:
      throw new Error(`Unknown event: ${event}`);
  }
}

// ── HTTP entrypoint ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const event = body?.event as string | undefined;
    const viewing_id = body?.viewing_id as string | undefined;
    if (!viewing_id) {
      return new Response(JSON.stringify({ error: "viewing_id required" }), { status: 400 });
    }

    if (!event) {
      // Legacy V1 fallback
      const viewing = await loadViewing(viewing_id);
      const result = await legacyCaptainNotify(viewing);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await dispatch(event, viewing_id);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
