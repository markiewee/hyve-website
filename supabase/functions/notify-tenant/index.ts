import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const NOTIFY_URL =
  Deno.env.get("NOTIFY_URL") || "https://www.lazybee.sg/api/portal/admin-actions";
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const PORTAL_BASE = "https://www.lazybee.sg";
const LOGO_URL = `${PORTAL_BASE}/hyve_green.png`;
const HERO_GENERIC = `${PORTAL_BASE}/hero_email_generic.jpg`;
const HERO_URGENT = `${PORTAL_BASE}/hero_email_urgent.jpg`;

// ─── Email layout helpers ──────────────────────────────────────────
// Email-safe HTML: table layouts, inline CSS, hex colors, no JS,
// no Tailwind utility classes (Tailwind CDN script is stripped by Gmail/Outlook).

type Detail = { label: string; value: string };

interface LayoutInput {
  preheader?: string;            // shown in inbox preview
  badge: string;                 // "MEMBER UPDATE" etc.
  headline: string;
  greeting?: string;             // "Hi Mark,"
  paragraphs: string[];
  details?: Detail[];
  cta: { label: string; url: string };
  ctaCaption?: string;           // small caption under the CTA
}

function escape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function detailsTable(details: Detail[] | undefined, accent: string): string {
  if (!details || !details.length) return "";
  const rows = details
    .map(
      (d) => `
        <tr>
          <td style="padding:8px 16px 8px 0;color:#6e7976;font-size:13px;vertical-align:top;white-space:nowrap">${escape(d.label)}</td>
          <td style="padding:8px 0;color:#191c20;font-size:14px;vertical-align:top">${d.value}</td>
        </tr>`
    )
    .join("");
  return `
    <tr>
      <td style="padding:0 0 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e1e2e8;border-left:3px solid ${accent};border-radius:12px">
          <tr><td style="padding:16px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
        </table>
      </td>
    </tr>`;
}

function renderEmail(opts: LayoutInput & { variant: "generic" | "urgent" }): string {
  const isUrgent = opts.variant === "urgent";
  const primary = isUrgent ? "#ba1a1a" : "#006b5f";
  const badgeBg = isUrgent ? "#ffdad6" : "#d7e6e2";
  const badgeFg = isUrgent ? "#93000a" : "#005047";
  const heroSrc = isUrgent ? HERO_URGENT : HERO_GENERIC;
  const subBrand = isUrgent ? "Hyve Updates" : "Hyve Co-living";

  const preheader = opts.preheader || opts.headline;
  const greeting = opts.greeting ? `<p style="margin:0 0 16px 0">${escape(opts.greeting)}</p>` : "";
  const paras = opts.paragraphs
    .map((p) => `<p style="margin:0 0 16px 0">${p}</p>`)
    .join("");
  const ctaCaption = opts.ctaCaption
    ? `<tr><td align="center" style="padding:12px 0 0 0;font-size:11px;color:#6e7976;letter-spacing:0.15em;text-transform:uppercase">${escape(opts.ctaCaption)}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f8f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#191c20;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;color:transparent">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8f9ff">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%">
      <!-- Header -->
      <tr><td style="padding:0 0 24px 0;font-size:18px;font-weight:700;color:${primary};letter-spacing:-0.3px">${subBrand}</td></tr>
      <!-- Hero -->
      <tr><td style="padding:0 0 24px 0">
        <img src="${heroSrc}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:16px;border:0">
      </td></tr>
      <!-- Badge -->
      <tr><td style="padding:0 0 12px 0">
        <span style="display:inline-block;padding:6px 12px;background:${badgeBg};color:${badgeFg};border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase">${escape(opts.badge)}</span>
      </td></tr>
      <!-- Headline -->
      <tr><td style="padding:0 0 20px 0;font-size:30px;font-weight:800;line-height:1.1;letter-spacing:-1px;color:#191c20">${escape(opts.headline)}</td></tr>
      <!-- Body -->
      <tr><td style="padding:0 0 24px 0;font-size:15px;line-height:1.65;color:#3e4946">
        ${greeting}
        ${paras}
      </td></tr>
      ${detailsTable(opts.details, primary)}
      <!-- CTA -->
      <tr><td align="center" style="padding:0">
        <a href="${escape(opts.cta.url)}" style="display:inline-block;padding:14px 32px;background:${primary};color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;letter-spacing:0.2px">${escape(opts.cta.label)}</a>
      </td></tr>
      ${ctaCaption}
      <!-- Footer -->
      <tr><td align="center" style="padding:48px 0 0 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid #e1e2e8;height:1px;line-height:1px;font-size:1px">&nbsp;</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 0 0 0">
        <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#191c20">Hyve Co-living HQ</p>
        <p style="margin:0 0 16px 0;font-size:11px;color:#6e7976">39 Jalan Kelulut, Singapore 809056</p>
        <p style="margin:0;font-size:10px;color:#9aa3a1;letter-spacing:0.2em;text-transform:uppercase">&copy; 2026 Hyve Living</p>
        <p style="margin:8px 0 0 0;font-size:11px;color:#6e7976">
          <a href="${PORTAL_BASE}/privacy-policy" style="color:#6e7976;text-decoration:underline">Privacy</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:hello@lazybee.sg?subject=Unsubscribe" style="color:#6e7976;text-decoration:underline">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const generic = (o: LayoutInput) => renderEmail({ ...o, variant: "generic" });
const urgent = (o: LayoutInput) => renderEmail({ ...o, variant: "urgent" });

// ─── Send via Resend (or NOTIFY_URL fallback) ──────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hyve <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`resend ${r.status}: ${text.slice(0, 500)}`);
    return text;
  }

  const r = await fetch(NOTIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-notify-secret": NOTIFY_SECRET },
    body: JSON.stringify({ action: "notify", to, subject, html }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`notify endpoint ${r.status}: ${text.slice(0, 500)}`);
  return text;
}

// ─── Tenant lookup ─────────────────────────────────────────────────

async function getTenantContext(tenantProfileId: string) {
  const { data: details } = await supabase
    .from("tenant_details")
    .select("full_name, email")
    .eq("tenant_profile_id", tenantProfileId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("user_id")
    .eq("id", tenantProfileId)
    .maybeSingle();

  let email = details?.email || null;
  if (!email && profile?.user_id) {
    const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
    const authEmail = userData?.user?.email || null;
    if (authEmail && !authEmail.endsWith("@portal.hyve.sg")) email = authEmail;
  }
  const fullName = details?.full_name || "";
  const firstName = fullName.split(" ")[0] || "there";
  return { email, fullName, firstName };
}

// ─── Event handlers ────────────────────────────────────────────────

interface BuiltEmail {
  subject: string;
  html: string;
}

async function buildEmail(
  event_type: string,
  tenant_profile_id: string,
  details: Record<string, any>,
  firstName: string
): Promise<BuiltEmail | null> {
  switch (event_type) {
    case "TICKET_STATUS_CHANGED": {
      const { ticket_category, new_status, resolution_note, ticket_id } = details;
      const cat = String(ticket_category || "").toLowerCase();
      let unitCode: string | null = null;
      let description: string | null = null;
      if (ticket_id) {
        const { data: tk } = await supabase
          .from("maintenance_tickets")
          .select("description, rooms(unit_code)")
          .eq("id", ticket_id)
          .maybeSingle();
        unitCode = (tk as any)?.rooms?.unit_code ?? null;
        description = (tk as any)?.description ?? null;
      }

      const COPY: Record<string, { headline: string; lead: string; cta: string; caption: string }> = {
        OPEN: {
          headline: `We've received your ${cat} request.`,
          lead: `Thanks for letting us know. We've logged the request and a team member will look into it shortly.`,
          cta: "View in Portal",
          caption: "Average response within 4 hours",
        },
        ACKNOWLEDGED: {
          headline: `We've seen your ${cat} request.`,
          lead: `Quick note to confirm we've seen your request. Someone from the team will be in touch with next steps soon.`,
          cta: "View in Portal",
          caption: "We'll update you when we start work",
        },
        IN_PROGRESS: {
          headline: `We're on your ${cat} request.`,
          lead: `A team member is actively working on this now. We'll let you know as soon as it's resolved.`,
          cta: "View in Portal",
          caption: "Reply to this email if anything changes",
        },
        ESCALATED: {
          headline: `We've escalated your ${cat} request.`,
          lead: `This issue has been escalated for priority attention. Expect an update from a senior team member shortly.`,
          cta: "View in Portal",
          caption: "Priority support engaged",
        },
        RESOLVED: {
          headline: `Your ${cat} request is resolved.`,
          lead: `Good news — this is now marked as resolved. Reply to this email or open a new ticket if anything still isn't right.`,
          cta: "View in Portal",
          caption: "Issue closed",
        },
      };
      const c = COPY[new_status] ?? {
        headline: `Update on your ${cat} request.`,
        lead: `Your maintenance ticket status is now ${new_status}.`,
        cta: "View in Portal",
        caption: "",
      };

      const detailRows: Detail[] = [
        {
          label: "Issue",
          value: `<strong>${escape(ticket_category || "Maintenance")}</strong>${unitCode ? ` &middot; <span style="font-family:monospace;background:#eff4ff;padding:2px 8px;border-radius:4px;font-size:12px">${escape(unitCode)}</span>` : ""}`,
        },
      ];
      if (description) detailRows.push({ label: "Reported", value: escape(description) });
      if (new_status === "RESOLVED" && resolution_note)
        detailRows.push({ label: "Resolution", value: escape(resolution_note) });

      const isUrgent = new_status === "ESCALATED";
      const fn = isUrgent ? urgent : generic;
      return {
        subject: c.headline.replace(/\.$/, ""),
        html: fn({
          preheader: c.lead.slice(0, 120),
          badge: isUrgent ? "Escalated" : new_status === "RESOLVED" ? "Resolved" : "Maintenance Update",
          headline: c.headline,
          greeting: `Hi ${firstName},`,
          paragraphs: [c.lead],
          details: detailRows,
          cta: { label: c.cta, url: `${PORTAL_BASE}/portal/issues` },
          ctaCaption: c.caption,
        }),
      };
    }

    case "DEPOSIT_VERIFIED":
      return {
        subject: "Your deposit is verified",
        html: generic({
          badge: "Onboarding",
          headline: "Your deposit is verified.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Your deposit payment has been confirmed by our team. You're cleared to continue with the rest of onboarding.",
          ],
          cta: { label: "Continue Onboarding", url: `${PORTAL_BASE}/portal/onboarding` },
          ctaCaption: "A few short steps left",
        }),
      };

    case "TA_READY":
      return {
        subject: "Your licence agreement is ready to sign",
        html: generic({
          badge: "Action Required",
          headline: "Your agreement is ready to sign.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Your licence agreement has been uploaded and is ready for your digital signature. It takes about 2 minutes.",
          ],
          cta: { label: "Sign Now", url: `${PORTAL_BASE}/portal/onboarding` },
          ctaCaption: "Signed digitally — no printing",
        }),
      };

    case "AC_THRESHOLD_WARNING": {
      const { hours_used, free_hours } = details;
      return {
        subject: `AC usage alert — ${Math.round(hours_used)}/${free_hours} free hours`,
        html: urgent({
          badge: "Usage Alert",
          headline: "You're approaching your free AC hours.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `You've used <strong>${Math.round(hours_used)} hours</strong> of your <strong>${free_hours} free AC hours</strong> this month.`,
            "Usage beyond your free allowance is charged at <strong>SGD $0.30/hour</strong>.",
          ],
          cta: { label: "Check Usage", url: `${PORTAL_BASE}/portal/dashboard` },
          ctaCaption: "Tracked in real time",
        }),
      };
    }

    case "MEMBER_CREATED": {
      const { username, password, login_url } = details;
      return {
        subject: "Welcome to Hyve — your account is ready",
        html: generic({
          badge: "Welcome",
          headline: "Your member account is ready.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Welcome to the Hyve community. Use the credentials below to sign in for the first time, then change your password from the settings page.",
          ],
          details: [
            { label: "Username", value: `<code style="font-family:monospace;background:#eff4ff;padding:2px 8px;border-radius:4px;font-size:13px">${escape(username)}</code>` },
            { label: "Password", value: `<code style="font-family:monospace;background:#eff4ff;padding:2px 8px;border-radius:4px;font-size:13px">${escape(password)}</code>` },
          ],
          cta: { label: "Log In", url: login_url || `${PORTAL_BASE}/portal/login` },
          ctaCaption: "Change your password after first login",
        }),
      };
    }

    case "TA_COUNTER_SIGNED": {
      const { ref_number } = details;
      return {
        subject: "Your licence agreement is fully executed",
        html: generic({
          badge: "Document Ready",
          headline: "Your agreement is fully executed.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your licence agreement${ref_number ? ` (Ref: <strong>${escape(ref_number)}</strong>)` : ""} has been counter-signed and is now legally binding.`,
            "You can download a copy from your portal at any time.",
          ],
          cta: { label: "View Documents", url: `${PORTAL_BASE}/portal/documents` },
        }),
      };
    }

    case "RENT_OVERDUE": {
      const { month, amount, days_overdue, late_fee } = details;
      const dayWord = days_overdue === 1 ? "day" : "days";
      return {
        subject: `Rent overdue — ${month} (${days_overdue} ${dayWord})`,
        html: urgent({
          badge: "Payment Overdue",
          headline: "Your rent payment is overdue.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your rent for <strong>${escape(month)}</strong> of <strong>SGD ${escape(String(amount))}</strong> is now <strong>${days_overdue} ${dayWord}</strong> past due.`,
            late_fee ? `A late fee of <strong>SGD ${escape(String(late_fee))}</strong> may apply.` : "",
            "Please make your payment as soon as possible to avoid further charges.",
          ].filter(Boolean),
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing` },
          ctaCaption: "Settle to clear all late fees",
        }),
      };
    }

    case "RENT_PAID": {
      const { month: paidMonth, amount: paidAmount } = details;
      return {
        subject: `Payment confirmed — ${paidMonth}`,
        html: generic({
          badge: "Payment Received",
          headline: "Thanks — payment confirmed.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `We've received your rent payment of <strong>SGD ${escape(String(paidAmount))}</strong> for <strong>${escape(paidMonth)}</strong>. You're all set for this month.`,
          ],
          cta: { label: "View Billing", url: `${PORTAL_BASE}/portal/billing` },
        }),
      };
    }

    case "ANNOUNCEMENT": {
      const { title, content, priority } = details;
      const isUrgent = priority === "URGENT";
      const fn = isUrgent ? urgent : generic;
      return {
        subject: isUrgent ? `[Urgent] ${title}` : `Hyve announcement: ${title}`,
        html: fn({
          badge: isUrgent ? "Urgent" : priority === "WARNING" ? "Important" : "Announcement",
          headline: title,
          greeting: `Hi ${firstName},`,
          paragraphs: [content],
          cta: { label: "View in Portal", url: `${PORTAL_BASE}/portal/dashboard` },
        }),
      };
    }

    case "PASS_EXPIRING": {
      const { pass_type, expiry_date } = details;
      return {
        subject: "Your work pass is expiring soon",
        html: urgent({
          badge: "Action Required",
          headline: "Your work pass expires soon.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your <strong>${escape(pass_type || "work pass")}</strong> is expiring on <strong>${escape(expiry_date)}</strong>.`,
            "Please renew and upload the updated document to avoid any disruption to your tenancy.",
          ],
          cta: { label: "Upload Updated Pass", url: `${PORTAL_BASE}/portal/documents` },
        }),
      };
    }

    case "ONBOARDING_COMPLETE": {
      const { room_code, property_name } = details;
      return {
        subject: "Welcome home — onboarding complete",
        html: generic({
          badge: "All Set",
          headline: "You're an active member.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your onboarding is complete and you're now part of the Hyve community${property_name ? ` at <strong>${escape(property_name)}</strong>` : ""}${room_code ? ` (Room <strong>${escape(room_code)}</strong>)` : ""}.`,
            "Head to your dashboard to track AC usage, pay rent, and report any issues.",
          ],
          cta: { label: "Go to Dashboard", url: `${PORTAL_BASE}/portal/dashboard` },
          ctaCaption: "Welcome to the community",
        }),
      };
    }

    case "INVOICE_ISSUED": {
      return {
        subject: `Invoice ${details.invoice_code} — SGD ${details.amount}`,
        html: generic({
          badge: "New Invoice",
          headline: `Your invoice ${details.invoice_code} is ready.`,
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your invoice <strong>${escape(details.invoice_code)}</strong> for <strong>SGD ${escape(String(details.amount))}</strong> is ready to view and pay.`,
          ],
          details: [{ label: "Due", value: `<strong>${escape(details.due_date)}</strong>` }],
          cta: { label: "View & Pay", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_UPDATED": {
      return {
        subject: `Invoice ${details.invoice_code} updated — new total SGD ${details.amount}`,
        html: generic({
          badge: "Invoice Updated",
          headline: `Your invoice has new charges.`,
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your invoice <strong>${escape(details.invoice_code)}</strong> has been updated with usage charges. New total: <strong>SGD ${escape(String(details.amount))}</strong>.`,
          ],
          cta: { label: "View Details", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_PAID": {
      return {
        subject: `Payment received — invoice ${details.invoice_code}`,
        html: generic({
          badge: "Payment Received",
          headline: "Thanks — payment received.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `We've received your payment of <strong>SGD ${escape(String(details.amount))}</strong>. Invoice <strong>${escape(details.invoice_code)}</strong> is now fully paid.`,
          ],
          cta: { label: "View Billing", url: `${PORTAL_BASE}/portal/billing` },
        }),
      };
    }

    case "INVOICE_OVERDUE": {
      return {
        subject: `Invoice ${details.invoice_code} overdue — late fee applied`,
        html: urgent({
          badge: "Overdue",
          headline: `Your invoice is overdue.`,
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your invoice <strong>${escape(details.invoice_code)}</strong> is <strong>${days(details.days_overdue)}</strong> overdue. A late fee of <strong>SGD ${escape(String(details.late_fee))}</strong> has been applied.`,
            "Please settle the outstanding amount as soon as possible.",
          ],
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    default:
      return null;
  }
}

function days(n: number | string): string {
  const v = Number(n);
  return `${v} day${v === 1 ? "" : "s"}`;
}

// ─── Main handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const { event_type, tenant_profile_id, details = {} } = await req.json();
    if (!event_type || !tenant_profile_id) {
      return new Response(JSON.stringify({ error: "event_type and tenant_profile_id required" }), { status: 400 });
    }

    const ctx = await getTenantContext(tenant_profile_id);
    if (!ctx.email) {
      return new Response(JSON.stringify({ error: "No deliverable email for tenant" }), { status: 400 });
    }

    const built = await buildEmail(event_type, tenant_profile_id, details, ctx.firstName);
    if (!built) {
      return new Response(JSON.stringify({ error: `Unknown event_type: ${event_type}` }), { status: 400 });
    }

    await sendEmail(ctx.email, built.subject, built.html);
    return new Response(JSON.stringify({ sent: true, event_type, email: ctx.email }), { status: 200 });
  } catch (err: any) {
    console.error("notify-tenant error:", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err), stack: String(err?.stack || "") }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
