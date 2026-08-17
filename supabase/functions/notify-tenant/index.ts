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
          value: `<strong>${escape(ticket_category || "Maintenance")}</strong>${unitCode ? ` &middot; ${chip(unitCode)}` : ""}`,
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
            { label: "Username", value: chip(String(username)) },
            { label: "Password", value: chip(String(password)) },
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
        subject: `FINAL NOTICE: ${details.deadline ? `pay by ${details.deadline}` : "7 days"} or we begin ending your tenancy`,
        html: urgent({
          preheader: `Invoice ${details.invoice_code} is ${days(details.days_overdue)} overdue. This is the last notice before we act.`,
          banner: "Final notice before termination of tenancy",
          badge: "Final notice",
          headline: "We are preparing to end your tenancy.",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `Your rent is <strong>${days(details.days_overdue)}</strong> overdue. A second 5% late fee has been applied and the balance below is now payable in full.`,
            "<strong>This is the last email you will receive before we act.</strong> Under your licence agreement, non-payment of this length is grounds for terminating your right to occupy the room.",
            details.deadline
              ? `If the full amount does not reach us by <strong>${escape(String(details.deadline))}</strong>, we will issue formal notice to vacate, apply your deposit against the arrears, and hold you liable for whatever remains. Moving out does not clear the balance.`
              : "If the full amount does not reach us within <strong>7 days</strong>, we will issue formal notice to vacate, apply your deposit against the arrears, and hold you liable for whatever remains. Moving out does not clear the balance.",
            "If you cannot pay this in one go, reply to this email today and tell us what you can do. We would far rather agree a plan with you than take this any further, but we cannot do that if we do not hear from you.",
          ],
          money: {
            label: "Payable in full",
            value: `SGD ${escape(String(details.amount))}`,
            footnote: details.deadline
              ? `By ${escape(String(details.deadline))} · includes SGD ${escape(String(details.late_fee))} in late fees`
              : `Includes SGD ${escape(String(details.late_fee))} in late fees`,
          },
          details: [
            { label: "Invoice", value: chip(String(details.invoice_code)) },
            { label: "Overdue", value: `<strong>${days(details.days_overdue)}</strong>` },
            ...(details.deadline
              ? [{ label: "Pay by", value: `<strong>${escape(String(details.deadline))}</strong>` }]
              : []),
          ],
          cta: { label: "Pay Now", url: `${PORTAL_BASE}/portal/billing/${details.invoice_id}` },
          ctaCaption: "Or reply to this email today",
        }),
      };
    }

    case "OWNER_LOGIN_LINK": {
      return {
        subject: "Your Lazybee owner portal sign-in link",
        html: generic({
          badge: "Owner portal",
          headline: "Sign in to your owner portal",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            "Here is your secure sign-in link for the Lazybee owner portal. It signs you in directly, no password needed.",
            `The link is valid for 24 hours and can be used once. Need a new one? Go to the <a href="${PORTAL_BASE}/portal/login" style="color:#8A6733">portal sign-in page</a>, choose "Property owner? Sign in with an email link", and a fresh link will be sent to you.`,
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
          badge: "Owner portal",
          headline: "Your owner portal is ready",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `We've set up a private owner portal for <strong>${escape(propertyName)}</strong>. It shows who is staying in your unit, with passport / ID and immigration pass details and move-in / move-out dates, and lets you view and download each resident's ID and passport.`,
            "The button below signs you in directly, no password needed.",
            `Any time you want back in, go to the <a href="${PORTAL_BASE}/portal/login" style="color:#8A6733">portal sign-in page</a>, choose "Property owner? Sign in with an email link", enter this email address, and a fresh link will be sent to you.`,
          ],
          cta: { label: "View Portal", url: details.action_link },
          ctaCaption: "Signs you in directly",
        }),
      };
    }

    // Something landed in the portal: a message, a maintenance notice, a house
    // notice, a document. One template, four kinds, because they are the same
    // email with a different noun.
    //
    // The body carries a preview, never the full text. Two reasons: the click
    // has to land in the portal for the reply to happen in one place, and a
    // house notice should not sit in plaintext in a mailbox forever.
    case "PORTAL_NOTICE": {
      const kind = String(details.kind || "MESSAGE").toUpperCase();
      const isUrgentNotice = details.priority === "URGENT";
      const scope = details.scope ? String(details.scope) : "your house";

      const KINDS: Record<
        string,
        { badge: string; headline: string; lead: string; cta: string; caption: string; path: string }
      > = {
        MESSAGE: {
          badge: "New message",
          headline: "You have a new message.",
          lead: `<strong>${escape(String(details.from_name || "Someone"))}</strong> sent you a message in your Lazybee portal.`,
          cta: "Read & Reply",
          caption: "Reply from inside the portal",
          path: `/portal/messages/${details.thread_id ?? ""}`,
        },
        MAINTENANCE: {
          badge: "Maintenance notice",
          headline: "There's a maintenance notice for your place.",
          lead: `A maintenance notice has been posted for <strong>${escape(scope)}</strong>. Have a read so you know what to expect and when.`,
          cta: "Read the Notice",
          caption: "Posted by Lazybee ops",
          path: "/portal/notices",
        },
        NOTICE: {
          badge: "House notice",
          headline: "There's a new notice for your house.",
          lead: `A new notice has been posted for <strong>${escape(scope)}</strong>. It's in your portal now.`,
          cta: "Read the Notice",
          caption: "Posted by Lazybee ops",
          path: "/portal/notices",
        },
        DOCUMENT: {
          badge: "New document",
          headline: "A new document is in your portal.",
          lead: `<strong>${escape(String(details.subject || "A document"))}</strong> has been added to your documents.`,
          cta: "View Document",
          caption: "Download any time",
          path: "/portal/documents",
        },
      };
      const k = KINDS[kind] ?? KINDS.MESSAGE;

      const rows: Detail[] = [];
      if (details.from_name)
        rows.push({
          label: "From",
          value: `<strong>${escape(String(details.from_name))}</strong>${details.from_role ? ` &middot; ${escape(String(details.from_role))}` : ""}`,
        });
      if (details.subject && kind !== "DOCUMENT")
        rows.push({ label: "Subject", value: escape(String(details.subject)) });
      if (details.preview)
        rows.push({
          label: "Preview",
          value: `<span style="color:#5C5247">&ldquo;${escape(String(details.preview))}&rdquo;</span>`,
        });
      if (details.posted_at) rows.push({ label: "Posted", value: escape(String(details.posted_at)) });
      if (details.window)
        rows.push({ label: "Window", value: `<strong>${escape(String(details.window))}</strong>` });

      const subject =
        kind === "MESSAGE"
          ? `New message from ${details.from_name} in your Lazybee portal`
          : kind === "DOCUMENT"
            ? `New document: ${details.subject}`
            : `${isUrgentNotice ? "[Important] " : ""}${details.subject || k.badge} at ${scope}`;

      return {
        subject,
        html: (isUrgentNotice ? urgent : generic)({
          preheader: details.preview ? String(details.preview) : k.headline,
          badge: isUrgentNotice ? "Important notice" : k.badge,
          headline: k.headline,
          greeting: `Hi ${firstName},`,
          paragraphs: [
            k.lead,
            "Open it in the portal to read the full thing and reply. Everything stays in one place, so nothing gets lost in a chat thread.",
          ],
          details: rows,
          cta: { label: k.cta, url: `${PORTAL_BASE}${k.path}` },
          ctaCaption: k.caption,
        }),
      };
    }

    // The quiet-prospect nudge. Someone enquired, we replied, they went dark.
    //
    // Two links on purpose. "Still keen" books a viewing; "found somewhere
    // else" closes the lead in the CRM. The negative path is the valuable one:
    // it is the only thing that stops the chaser without a human reading the
    // thread, and 207 of the leads in the table are already closed_lost.
    case "LEAD_STILL_INTERESTED": {
      const roomLabel = String(details.room_label || "the room");
      const propertyName = String(details.property_name || "our place");
      const rows: Detail[] = [
        { label: "Room", value: `<strong>${escape(roomLabel)}</strong>` },
        { label: "House", value: escape(propertyName) },
      ];
      if (details.available_from)
        rows.push({ label: "Free from", value: `<strong>${escape(String(details.available_from))}</strong>` });
      if (details.enquired_on)
        rows.push({ label: "You asked", value: escape(String(details.enquired_on)) });

      return {
        subject: `Still keen on ${roomLabel}?`,
        html: generic({
          preheader: `The room at ${propertyName} is still going. One tap either way.`,
          badge: "Still looking?",
          headline: "Are you still after a room?",
          greeting: `Hi ${firstName},`,
          paragraphs: [
            `You asked about <strong>${escape(roomLabel)}</strong> at <strong>${escape(propertyName)}</strong> a little while back and we never heard how you got on.`,
            "No pressure at all. It's still available, so if you're still looking we'd love to show you around. If you've already found a place, just tap the second link and we'll stop emailing you.",
          ],
          money: details.price
            ? {
                label: "Monthly, all in",
                value: `SGD ${escape(String(details.price))}`,
                footnote: details.available_from
                  ? `Available from ${escape(String(details.available_from))}`
                  : null,
              }
            : null,
          details: rows,
          cta: {
            label: "Yes, book a viewing",
            url: `${PORTAL_BASE}/book/${details.property_slug}/${details.room_slug}`,
          },
          ctaCaption: "Takes about 30 seconds",
          secondary: {
            label: "I've found somewhere else, stop emailing me",
            url: `${PORTAL_BASE}/leads/close?t=${details.close_token}`,
          },
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

/**
 * Events addressed to a lead rather than a tenant. These carry their own
 * recipient in `details` and must skip the tenant lookup entirely: a
 * prospect has no tenant_profiles row, so getTenantContext would find
 * nothing and the send would 400.
 */
const LEAD_EVENTS = new Set(["LEAD_STILL_INTERESTED"]);

/**
 * Events that render but do not send to the tenant without a human first.
 *
 * INVOICE_FINAL_NOTICE states we will issue notice to vacate and apply the
 * deposit against what is owed. That is a legal posture, not a chase, and it
 * should not leave the building because a cron counted to twenty-nine. The
 * late fee still applies on schedule; only the email waits.
 */
const HELD_EVENTS = new Set(["INVOICE_FINAL_NOTICE"]);

const ADMIN_EMAIL = Deno.env.get("LAZYBEE_ADMIN_EMAIL") || "admin@lazybee.sg";

/** Prepended to a held email so the ops inbox knows what it is looking at. */
function heldBanner(wouldSendTo: string, who: string): string {
  return `<div style="background:#241C16;color:#F6F2EA;padding:18px 22px;
font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.7">
<strong style="letter-spacing:.18em;text-transform:uppercase">Held for approval</strong><br>
This final notice was generated by the arrears ladder and has <strong>not</strong> been sent.<br>
Recipient if approved: <strong>${escape(who)} &lt;${escape(wouldSendTo)}&gt;</strong><br>
The late fee has already been applied. Forward this message to the tenant to send it.
</div>`;
}

Deno.serve(async (req) => {
  try {
    const { event_type, tenant_profile_id, details = {} } = await req.json();

    if (LEAD_EVENTS.has(event_type)) {
      if (!details.email) {
        return new Response(JSON.stringify({ error: "details.email required for lead events" }), { status: 400 });
      }
      const leadName = String(details.first_name || "there");
      const leadBuilt = await buildEmail(event_type, "", details, leadName);
      if (!leadBuilt) {
        return new Response(JSON.stringify({ error: `Unknown event_type: ${event_type}` }), { status: 400 });
      }
      await sendEmail(String(details.email), leadBuilt.subject, leadBuilt.html);
      return new Response(JSON.stringify({ sent: true, event_type, email: details.email }), { status: 200 });
    }

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

    // A held event is fully rendered but delivered to the ops inbox instead of
    // the tenant. Mark reads the exact email that would have gone out and
    // decides. Nothing about the fee schedule changes; only the send waits.
    if (HELD_EVENTS.has(event_type)) {
      await sendEmail(
        ADMIN_EMAIL,
        `[HOLD, approve before sending] ${built.subject}`,
        heldBanner(ctx.email, ctx.fullName || ctx.firstName) + built.html
      );
      return new Response(
        JSON.stringify({ held: true, event_type, would_send_to: ctx.email }),
        { status: 200 }
      );
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
