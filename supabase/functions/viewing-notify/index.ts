// supabase/functions/viewing-notify/index.ts
//
// Event-driven viewing notifications for Lazybee Booking V2.
//
// Invocation:
//   POST { event: <event-type>, viewing_id: <uuid> }
//
// Supported events:
//   - viewing-confirmation       → prospect (with .ics + cancel link)
//   - viewing-captain-notify     → captain
//   - viewing-admin-notify       → admin@lazybee.sg / mark@meetmillia.com
//   - viewing-reminder-24h       → prospect + cc admin (door code, captain, mailbox, parking — evening before)
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

import {
  fmtDateTime,
  buildIcs,
  b64,
  tplConfirmation,
  tplCaptainNotify,
  tplAdminNotify,
  tplReminder24h,
  tplCancelled,
  tplOffHorizonReminder,
} from "../_shared/viewingEmails.js";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SENDER = "Lazybee Co-living <hello@lazybee.sg>";
const ADMIN_EMAIL = Deno.env.get("LAZYBEE_ADMIN_EMAIL") || "admin@lazybee.sg";
const ADMIN_CC = Deno.env.get("LAZYBEE_ADMIN_CC") || "mark@meetmillia.com";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://lazybee.sg";

// Beeper Local API for WhatsApp on off-horizon reminders.
// Spec: docs/specs/2026-05-15-viewing-clustering.md §4.3
const BEEPER_API_URL = Deno.env.get("BEEPER_API_URL") || "http://127.0.0.1:23373";
const BEEPER_API_TOKEN = Deno.env.get("BEEPER_API_TOKEN") || "";

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

// ── Lookup helpers ────────────────────────────────────────────────────
async function loadViewing(viewing_id: string) {
  const { data, error } = await supabase
    .from("property_viewings")
    .select(
      "*, properties(name, code, address, default_access_code, default_security_instructions), rooms(name, unit_code)"
    )
    .eq("id", viewing_id)
    .single();
  if (error || !data) throw new Error("Viewing not found");
  return data;
}

async function loadLead(lead_id: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, email, phone, chat_id, intent, property_interest")
    .eq("id", lead_id)
    .single();
  if (error || !data) throw new Error("Lead not found");
  return data;
}

async function sendWhatsApp(chatId: string | null, text: string) {
  if (!chatId) return { skipped: "no chat_id" };
  if (!BEEPER_API_TOKEN) return { skipped: "no BEEPER_API_TOKEN" };
  try {
    const r = await fetch(`${BEEPER_API_URL}/v1/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEEPER_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chatID: chatId, text }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { ok: false, status: r.status, body: body.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function loadCaptain(
  captain_id: string | null,
  property_id?: string | null
): Promise<{ email: string | null; name: string; phone: string | null }> {
  let id = captain_id;

  // Bookings do not reliably carry a captain: every viewing on the books right
  // now has captain_id null, which is why a prospect was told their house
  // captain was called "House Captain". Each property that has one has exactly
  // one active HOUSE_CAPTAIN row carrying its property_id, so ask the property.
  // Chiltern Park genuinely has none, and that is a real answer rather than a
  // gap: those emails read as self-serve on the door code.
  if (!id && property_id) {
    const { data: byProperty } = await supabase
      .from("tenant_profiles")
      .select("id")
      .eq("role", "HOUSE_CAPTAIN")
      .eq("property_id", property_id)
      .eq("is_active", true)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    id = byProperty?.id ?? null;
  }

  if (!id) return { email: null, name: "House Captain", phone: null };
  const { data: captain } = await supabase
    .from("tenant_profiles")
    .select("user_id, tenant_details(full_name, email, phone)")
    .eq("id", id)
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

function whatsAppOffHorizonText(lead: any) {
  const property = (lead.property_interest && lead.property_interest[0]) || "Lazybee";
  const targetDate = lead.intent?.target_move_in_date || "your target date";
  return [
    `Hi ${lead.name || "there"}, you mentioned a move-in around ${targetDate}.`,
    `We have viewing slots open at ${property} over the next two weekends. Want to lock one in?`,
    ``,
    `Please let me know if you have any questions.`,
    ``,
    `https://lazybee.sg/book`,
  ].join("\n");
}

// ── Legacy fallback (V1 captain notify) ───────────────────────────────
// Kept alive for callers that post without an `event`. It used to carry a
// fourth hand-rolled copy of the captain email; it now sends the same one
// everything else does, so a copy or design change cannot miss this path.
async function legacyCaptainNotify(viewing: any) {
  const captain = await loadCaptain(viewing.captain_id, viewing.property_id);
  const t = tplCaptainNotify({ viewing, captainName: captain.name });
  if (captain.email) await sendEmail({ to: captain.email, subject: t.subject, html: t.html });
  await sendEmail({ to: ADMIN_EMAIL, subject: t.subject, html: t.html });
  return { sent: true, captain_email: captain.email, admin_email: ADMIN_EMAIL };
}

// ── Dispatcher ────────────────────────────────────────────────────────
async function dispatch(event: string, ids: { viewing_id?: string; lead_id?: string }) {
  // Lead-targeted events branch first
  if (event === "lead-off-horizon-reminder") {
    if (!ids.lead_id) throw new Error("lead_id required");
    const lead = await loadLead(ids.lead_id);
    const out: Record<string, unknown> = {};
    if (lead.email) {
      const t = tplOffHorizonReminder(lead);
      await sendEmail({ to: lead.email, subject: t.subject, html: t.html });
      out.email = lead.email;
    }
    if (lead.chat_id) {
      const wa = await sendWhatsApp(lead.chat_id, whatsAppOffHorizonText(lead));
      out.whatsapp = wa;
    }
    return { sent: true, ...out };
  }

  // Viewing-targeted events from here
  if (!ids.viewing_id) throw new Error("viewing_id required");
  const viewing = await loadViewing(ids.viewing_id);
  const captain = await loadCaptain(viewing.captain_id, viewing.property_id);
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
      const t = tplReminder24h({ viewing, captain, cancelUrl });
      await sendEmail({
        to: viewing.prospect_email,
        cc: [ADMIN_EMAIL],
        subject: t.subject,
        html: t.html,
      });
      await supabase
        .from("property_viewings")
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq("id", viewing.id);
      return { sent: true, to: viewing.prospect_email, cc: ADMIN_EMAIL };
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
    const lead_id = body?.lead_id as string | undefined;

    if (!viewing_id && !lead_id) {
      return new Response(
        JSON.stringify({ error: "viewing_id or lead_id required" }),
        { status: 400 }
      );
    }

    if (!event) {
      // Legacy V1 fallback (viewing-targeted only)
      if (!viewing_id) {
        return new Response(JSON.stringify({ error: "viewing_id required" }), { status: 400 });
      }
      const viewing = await loadViewing(viewing_id);
      const result = await legacyCaptainNotify(viewing);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await dispatch(event, { viewing_id, lead_id });
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
