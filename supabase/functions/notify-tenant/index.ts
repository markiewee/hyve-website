import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generic, urgent, escape, chip } from "../_shared/emailShell.js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const NOTIFY_URL =
  Deno.env.get("NOTIFY_URL") || "https://www.lazybee.sg/api/portal/admin-actions";
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const PORTAL_BASE = "https://www.lazybee.sg";

/** A label/value pair rendered as one hairline-separated row. */
type Detail = { label: string; value: string };

// ─── Send via Resend (or NOTIFY_URL fallback) ──────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Lazybee Co-living <hello@lazybee.sg>",
      reply_to: "hello@lazybee.sg",
      to: [to],
      // Silent copy of every outbound notification to the ops inbox.
      bcc: ["admin@lazybee.sg"],
      subject,
      html,
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`resend ${r.status}: ${text.slice(0, 500)}`);
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
    if (authEmail && !authEmail.endsWith("@portal.lazybee.sg")) email = authEmail;
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
          lead: `Good news, this is now marked as resolved. Reply to this email or open a new ticket if anything still isn't right.`,
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
          ctaCaption: "Signed digitally, no printing",
        }),
      };

    case "AC_THRESHOLD_WARNING": {
      const { hours_used, free_hours } = details;
      return {
        subject: `AC usage alert: ${Math.round(hours_used)} of ${free_hours} free hours`,
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
        subject: "Welcome to Lazybee, your account is ready",
        html: generic({
          badge: "Welcome",
          headline: "Your member account is ready.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Welcome to the Lazybee community. Use the credentials below to sign in for the first time, then change your password from the settings page.",
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

    case "PASSWORD_RESET": {
      const { reset_url, expires_in_minutes } = details;
      const ttl = expires_in_minutes || 60;
      return {
        subject: "Reset your Lazybee portal password",
        html: generic({
          preheader: "A password reset was requested for your account.",
          badge: "Password Reset",
          headline: "Reset your password.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "We received a request to reset the password for your Lazybee portal account. Click the button below to choose a new one.",
            `This link expires in ${ttl} minutes. If you didn't request a reset, you can ignore this email and your password won't change.`,
          ],
          cta: { label: "Reset Password", url: reset_url },
          ctaCaption: "One-time use link",
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

    // Retained as the generic arrears fallback. The nightly ladder no longer
    // sends this: check-late-fees now emits a specific INVOICE_* event per
    // rung, because every rung used to send this one email and a tenant three
    // days late read the same words as one twenty-nine days late.
    case "RENT_OVERDUE": {
      const { month, amount, days_overdue, late_fee } = details;
      const dayWord = days_overdue === 1 ? "day" : "days";
      return {
        subject: `Rent overdue: ${month} (${days_overdue} ${dayWord})`,
        html: urgent({
          badge: "Payment overdue",
          headline: "Your rent is overdue.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your rent for <strong>${escape(month)}</strong> is now <strong>${days_overdue} ${dayWord}</strong> past due.`,
            late_fee ? `A late fee of <strong>SGD ${escape(String(late_fee))}</strong> may apply.` : "",
            "Please make payment as soon as you can to avoid further charges.",
          ].filter(Boolean),
          money: {
            label: "Outstanding",
            value: `SGD ${escape(String(amount))}`,
            footnote: `${days_overdue} ${dayWord} past due`,
          },
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing` },
          ctaCaption: "Settle to clear all late fees",
        }),
      };
    }

    // The reference is the whole point of this email. Verification matches a
    // bank credit on payment_ref and nothing else, because amounts are neither
    // unique across tenants nor stable (they prorate). If the tenant never
    // sees their ref, every payment lands unattributed and a human has to
    // guess. So the ref is the most prominent thing here, not a footnote.
    case "RENT_DUE": {
      const { month: dueMonth, amount: dueAmount, due_date, payment_ref, prorated_note } = details;
      return {
        subject: `Rent for ${dueMonth}, SGD ${escape(String(dueAmount))} due`,
        html: generic({
          badge: "Rent due",
          headline: `Your rent for ${escape(String(dueMonth))}.`,
          greeting: `Hi ${firstName},`,
          paragraphs: [
            prorated_note ? escape(String(prorated_note)) : "",
            payment_ref
              ? "Please put the reference below in the transfer field. That code is how the payment is matched to you automatically, and without it we have to chase you to confirm it arrived."
              : "",
          ].filter(Boolean),
          money: {
            label: "Amount due",
            value: `SGD ${escape(String(dueAmount))}`,
            footnote: `Due ${escape(String(due_date))}`,
          },
          details: payment_ref ? [{ label: "Payment ref", value: chip(String(payment_ref)) }] : [],
          cta: { label: "View Billing", url: `${PORTAL_BASE}/portal/billing` },
          ctaCaption: payment_ref ? `Reference: ${payment_ref}` : undefined,
        }),
      };
    }

    case "RENT_PAID": {
      const { month: paidMonth, amount: paidAmount } = details;
      return {
        subject: `Payment confirmed for ${paidMonth}`,
        html: generic({
          badge: "Payment received",
          headline: "Thanks, payment confirmed.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `We've received your rent for <strong>${escape(paidMonth)}</strong>. You're all set for this month.`,
          ],
          money: {
            label: "Received",
            value: `SGD ${escape(String(paidAmount))}`,
            footnote: escape(String(paidMonth)),
          },
          cta: { label: "View Billing", url: `${PORTAL_BASE}/portal/billing` },
        }),
      };
    }

    case "ANNOUNCEMENT": {
      const { title, content, priority } = details;
      const isUrgent = priority === "URGENT";
      const fn = isUrgent ? urgent : generic;
      return {
        subject: isUrgent ? `[Urgent] ${title}` : `Lazybee announcement: ${title}`,
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
        subject: "Welcome home, onboarding complete",
        html: generic({
          badge: "All Set",
          headline: "You're an active member.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your onboarding is complete and you're now part of the Lazybee community${property_name ? ` at <strong>${escape(property_name)}</strong>` : ""}${room_code ? ` (Room <strong>${escape(room_code)}</strong>)` : ""}.`,
            "Head to your dashboard to track AC usage, pay rent, and report any issues.",
          ],
          cta: { label: "Go to Dashboard", url: `${PORTAL_BASE}/portal/dashboard` },
          ctaCaption: "Welcome to the community",
        }),
      };
    }

    case "INVOICE_ISSUED": {
      return {
        subject: `Invoice ${details.invoice_code} for SGD ${details.amount}`,
        html: generic({
          badge: "New invoice",
          headline: "Your invoice is ready.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Your invoice is up in the portal. You can pay it there by card, or transfer and use the reference below.",
          ],
          money: {
            label: "Amount due",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: `Due ${escape(String(details.due_date))}`,
          },
          details: [
            { label: "Invoice", value: chip(String(details.invoice_code)) },
            ...(details.payment_ref
              ? [{ label: "Payment ref", value: chip(String(details.payment_ref)) }]
              : []),
          ],
          cta: { label: "View & Pay", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_UPDATED": {
      return {
        subject: `Invoice ${details.invoice_code} updated, new total SGD ${details.amount}`,
        html: generic({
          badge: "Invoice updated",
          headline: "Your invoice has new charges.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "We've added this month's usage to your invoice. Nothing else has changed.",
          ],
          money: {
            label: "New total",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: details.previous_amount
              ? `Was SGD ${escape(String(details.previous_amount))}`
              : null,
          },
          details: [{ label: "Invoice", value: chip(String(details.invoice_code)) }],
          cta: { label: "View Details", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_PAID": {
      return {
        subject: `Payment received for invoice ${details.invoice_code}`,
        html: generic({
          badge: "Payment received",
          headline: "Thanks, that's settled.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "We've received your payment and the invoice is now fully paid. A receipt is in your portal whenever you need it.",
          ],
          money: {
            label: "Paid",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: escape(String(details.invoice_code)),
          },
          cta: { label: "View Billing", url: `${PORTAL_BASE}/portal/billing` },
        }),
      };
    }

    case "INVOICE_OVERDUE": {
      return {
        subject: `Invoice ${details.invoice_code} overdue, late fee applied`,
        html: urgent({
          badge: "Overdue",
          headline: "Your invoice is overdue.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your invoice is <strong>${days(details.days_overdue)}</strong> overdue and a 5% late fee has been applied.`,
            "Please settle the outstanding amount as soon as you can.",
          ],
          money: {
            label: "Now owing",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: `Includes SGD ${escape(String(details.late_fee))} late fee`,
          },
          details: [{ label: "Invoice", value: chip(String(details.invoice_code)) }],
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_LATE_NOTICE": {
      return {
        subject: `Friendly reminder: rent for ${details.month_label || "this month"} is overdue`,
        html: generic({
          badge: "Payment reminder",
          headline: "Just a heads up on your rent.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Your invoice hasn't come through yet. If you've already paid, ignore this, bank transfers can take a day to clear.",
            "Otherwise, whenever you get a chance.",
          ],
          money: {
            label: "Outstanding",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: details.month_label ? `For ${escape(String(details.month_label))}` : null,
          },
          details: [{ label: "Invoice", value: chip(String(details.invoice_code)) }],
          cta: { label: "View & Pay", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_LATE_FEE_WARNING": {
      return {
        subject: `Late fee applies tomorrow on invoice ${details.invoice_code}`,
        html: urgent({
          badge: "Late fee tomorrow",
          headline: "Pay today to avoid the late fee.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your invoice is now <strong>${days(details.days_overdue)}</strong> overdue. If it isn't settled by tomorrow, a 5% late fee is added automatically.`,
            "If something's gone wrong with the payment, reply to this email and we'll sort it out.",
          ],
          money: {
            label: "Outstanding",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: `Late fee if unpaid: SGD ${escape(String(details.estimated_late_fee))}`,
          },
          details: [{ label: "Invoice", value: chip(String(details.invoice_code)) }],
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_OVERDUE_REMINDER": {
      const d = Number(details.days_overdue);
      const tier = d >= 25 ? "final" : d >= 15 ? "firm" : "soft";
      const badge = tier === "final" ? "Urgent, final reminder" : tier === "firm" ? "Outstanding Balance" : "Still Outstanding";
      const headline =
        tier === "final"
          ? `Last reminder before escalation.`
          : tier === "firm"
            ? `Your invoice is still unpaid.`
            : `Just a follow-up on your unpaid invoice.`;
      const closing =
        tier === "final"
          ? `If this isn't paid within the next few days, we'll escalate to a final notice and begin the eviction process. Please pay or contact us today.`
          : tier === "firm"
            ? `Please settle this as soon as possible. If there's a problem with payment, reply to this email so we can sort it out.`
            : `Please settle when you can. Reply to this email if you need anything.`;
      return {
        subject:
          tier === "final"
            ? `URGENT: invoice ${details.invoice_code} is ${d} days overdue`
            : `Reminder: invoice ${details.invoice_code} is ${d} days overdue`,
        html: (tier === "soft" ? generic : urgent)({
          badge,
          headline,
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your invoice is now <strong>${days(d)}</strong> overdue.`,
            closing,
          ],
          money: {
            label: "Outstanding",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: `${days(d)} overdue`,
          },
          details: [{ label: "Invoice", value: chip(String(details.invoice_code)) }],
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
        }),
      };
    }

    case "INVOICE_FINAL_NOTICE": {
      return {
        subject: `FINAL NOTICE: Invoice ${details.invoice_code}`,
        html: urgent({
          badge: "Final notice",
          headline: "This is a final notice.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your invoice is now <strong>${days(details.days_overdue)}</strong> overdue and a second 5% late fee has been applied.`,
            "Per your licence agreement, continued non-payment is grounds for termination of your tenancy.",
            "<strong>Please settle the full amount within 7 days</strong>, or contact us immediately to discuss. Otherwise we will issue formal notice to vacate and apply the deposit against what is owed.",
          ],
          money: {
            label: "Total outstanding",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: `Includes SGD ${escape(String(details.late_fee))} in late fees`,
          },
          details: [{ label: "Invoice", value: chip(String(details.invoice_code)) }],
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
          ctaCaption: "Or reply to this email today",
        }),
      };
    }

    case "OWNER_LOGIN_LINK": {
      return {
        subject: "Your Lazybee owner portal sign-in link",
        html: generic({
          badge: "Owner Portal",
          headline: "Sign in to your owner portal",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Here is your secure sign-in link for the Lazybee owner portal. It signs you in directly, no password needed.",
            `The link is valid for 24 hours and can be used once. Need a new one? Go to the <a href="${PORTAL_BASE}/portal/login" style="color:#006b5f">portal sign-in page</a>, choose "Property owner? Sign in with an email link", and a fresh link will be sent to you.`,
          ],
          cta: { label: "View Portal", url: details.action_link },
          ctaCaption: "Signs you in directly",
        }),
      };
    }

    case "OWNER_WELCOME": {
      const propertyName = details.property_name || "your property";
      return {
        subject: `Your owner portal for ${propertyName} is ready`,
        html: generic({
          badge: "Owner Portal",
          headline: "Your owner portal is ready",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `We've set up a private owner portal for <strong>${escape(propertyName)}</strong>. It shows who is staying in your unit, with passport / ID and immigration pass details and move-in / move-out dates, and lets you view and download each resident's ID and passport.`,
            "The button below signs you in directly, no password needed.",
            `Any time you want back in, go to the <a href="${PORTAL_BASE}/portal/login" style="color:#006b5f">portal sign-in page</a>, choose "Property owner? Sign in with an email link", enter this email address, and a fresh link will be sent to you.`,
          ],
          cta: { label: "View Portal", url: details.action_link },
          ctaCaption: "Signs you in directly",
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
