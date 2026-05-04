import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const NOTIFY_URL =
  Deno.env.get("NOTIFY_URL") || "https://hyve.sg/api/portal/admin-actions";
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET") || "";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function sendEmail(to: string, subject: string, html: string) {
  // Prefer direct Resend call — cuts out the lazybee.sg/admin-actions middleman.
  // Falls back to NOTIFY_URL if RESEND_API_KEY isn't set on this edge function.
  if (RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
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
    headers: {
      "Content-Type": "application/json",
      "x-notify-secret": NOTIFY_SECRET,
    },
    body: JSON.stringify({ action: "notify", to, subject, html }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`notify endpoint ${r.status}: ${text.slice(0, 500)}`);
  return text;
}

async function getTenantEmail(tenantProfileId: string): Promise<string | null> {
  // Prefer tenant_details.email — that's the resident's real inbox.
  // Fall back to auth.users.email only if tenant_details has no email
  // (auth email is usually <username>@portal.hyve.sg for portal logins).
  const { data: details } = await supabase
    .from("tenant_details")
    .select("email")
    .eq("tenant_profile_id", tenantProfileId)
    .maybeSingle();
  if (details?.email) return details.email;

  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("user_id")
    .eq("id", tenantProfileId)
    .maybeSingle();
  if (!profile?.user_id) return null;

  const { data: userData } = await supabase.auth.admin.getUserById(
    profile.user_id
  );
  const email = userData?.user?.email || null;
  // Don't email the synthetic portal address.
  if (email && email.endsWith("@portal.hyve.sg")) return null;
  return email;
}

Deno.serve(async (req) => {
  try {
  const { event_type, ticket_id, tenant_profile_id, details } =
    await req.json();

  const email = await getTenantEmail(tenant_profile_id);
  if (!email) {
    return new Response(JSON.stringify({ error: "No email found" }), {
      status: 400,
    });
  }

  let subject = "";
  let html = "";

  switch (event_type) {
    case "TICKET_STATUS_CHANGED": {
      const { ticket_category, new_status, resolution_note, ticket_id } = details;

      const { data: td } = await supabase
        .from("tenant_details")
        .select("full_name")
        .eq("tenant_profile_id", tenant_profile_id)
        .maybeSingle();
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
      const firstName = (td?.full_name || "").split(" ")[0] || "there";
      const cat = String(ticket_category || "").toLowerCase();

      const COPY: Record<string, { subject: string; lead: string }> = {
        OPEN: {
          subject: `We've received your ${cat} request`,
          lead: `Thanks for letting us know — we've logged your ${cat} request and a team member will look into it shortly.`,
        },
        ACKNOWLEDGED: {
          subject: `We've seen your ${cat} request`,
          lead: `Quick note to confirm we've seen your ${cat} request. Someone from the team will be in touch with next steps soon.`,
        },
        IN_PROGRESS: {
          subject: `We're on your ${cat} request now`,
          lead: `A team member is actively working on this. We'll let you know as soon as it's resolved.`,
        },
        ESCALATED: {
          subject: `Your ${cat} request has been escalated`,
          lead: `We've escalated this so it gets priority attention. Expect an update from a senior team member shortly.`,
        },
        RESOLVED: {
          subject: `Your ${cat} request is resolved`,
          lead: `Good news — this is marked as resolved. Reply to this email or open a new ticket if anything still isn't right.`,
        },
      };
      const copy = COPY[new_status] ?? {
        subject: `Update on your ${cat} request`,
        lead: `Your maintenance ticket status is now ${new_status}.`,
      };

      subject = copy.subject;
      const showResolution = new_status === "RESOLVED" && resolution_note;
      html = `
        <p>Hi ${firstName},</p>
        <p>${copy.lead}</p>
        <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Issue</td><td style="padding:4px 0"><strong>${ticket_category}</strong>${unitCode ? ` &middot; ${unitCode}` : ""}</td></tr>
          ${description ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Details</td><td style="padding:4px 0">${description}</td></tr>` : ""}
          ${showResolution ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Resolution</td><td style="padding:4px 0">${resolution_note}</td></tr>` : ""}
        </table>
        <p><a href="https://www.lazybee.sg/portal/issues" style="background:#006b5f;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">View in Portal</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px">&mdash; Hyve Co-Living</p>
      `;
      break;
    }
    case "DEPOSIT_VERIFIED": {
      subject = "Deposit Verified — Welcome to Hyve!";
      html = `
        <h2>Your deposit has been verified</h2>
        <p>Your deposit payment has been confirmed by our team. You can continue with your onboarding.</p>
        <p><a href="https://hyve.sg/portal/onboarding">Continue Onboarding</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "TA_READY": {
      subject = "Your Licence Agreement is Ready to Sign";
      html = `
        <h2>Your agreement is ready</h2>
        <p>Your licence agreement has been uploaded and is ready for your digital signature.</p>
        <p><a href="https://hyve.sg/portal/onboarding">Sign Now</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "AC_THRESHOLD_WARNING": {
      const { hours_used, free_hours } = details;
      subject = `AC Usage Alert: ${Math.round(hours_used)} of ${free_hours} free hours used`;
      html = `
        <h2>AC Usage Warning</h2>
        <p>You've used <strong>${Math.round(hours_used)} hours</strong> of your <strong>${free_hours} free AC hours</strong> this month.</p>
        <p>Usage beyond ${free_hours} hours is charged at <strong>SGD $0.30/hour</strong>.</p>
        <p><a href="https://hyve.sg/portal/dashboard">Check Dashboard</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "MEMBER_CREATED": {
      const { username, password, login_url } = details;
      subject = "Welcome to Hyve — Your Account is Ready";
      html = `
        <h2>Welcome to Hyve!</h2>
        <p>Your member account has been created. Here are your login credentials:</p>
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p>Please change your password after your first login.</p>
        <p><a href="${login_url || "https://hyve.sg/portal/login"}">Log In to Hyve Portal</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "TA_COUNTER_SIGNED": {
      const { ref_number } = details;
      subject = "Your Licence Agreement Has Been Fully Executed";
      html = `
        <h2>Agreement Fully Executed</h2>
        <p>Your licence agreement${ref_number ? ` (Ref: ${ref_number})` : ""} has been counter-signed and is now fully executed.</p>
        <p>You can download a copy from your portal at any time.</p>
        <p><a href="https://hyve.sg/portal/documents">View Documents</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "RENT_OVERDUE": {
      const { month, amount, days_overdue, late_fee } = details;
      subject = `Rent Overdue: ${month} — ${days_overdue} day${days_overdue === 1 ? "" : "s"} past due`;
      html = `
        <h2>Rent Payment Overdue</h2>
        <p>Your rent for <strong>${month}</strong> of <strong>SGD ${amount}</strong> is <strong>${days_overdue} day${days_overdue === 1 ? "" : "s"}</strong> overdue.</p>
        ${late_fee ? `<p>A late fee of <strong>SGD ${late_fee}</strong> may apply.</p>` : ""}
        <p>Please make your payment as soon as possible to avoid further charges.</p>
        <p><a href="https://hyve.sg/portal/billing">Pay Now</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "RENT_PAID": {
      const { month: paidMonth, amount: paidAmount } = details;
      subject = `Rent Payment Confirmed — ${paidMonth}`;
      html = `
        <h2>Payment Received</h2>
        <p>Your rent payment of <strong>SGD ${paidAmount}</strong> for <strong>${paidMonth}</strong> has been confirmed. Thank you!</p>
        <p><a href="https://hyve.sg/portal/billing">View Billing History</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "ANNOUNCEMENT": {
      const { title: annTitle, content: annContent, priority } = details;
      const priorityLabel = priority === "URGENT" ? " [URGENT]" : priority === "WARNING" ? " [Important]" : "";
      subject = `Hyve Announcement${priorityLabel}: ${annTitle}`;
      html = `
        <h2>${annTitle}</h2>
        ${priority === "URGENT" ? `<p style="color:#ba1a1a;font-weight:bold">This is an urgent announcement.</p>` : ""}
        <p>${annContent}</p>
        <p><a href="https://hyve.sg/portal/dashboard">View in Portal</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "PASS_EXPIRING": {
      const { pass_type, expiry_date, tenant_name } = details;
      subject = `Work Pass Expiring Soon — Action Required`;
      html = `
        <h2>Work Pass Expiring Soon</h2>
        <p>Hi${tenant_name ? ` ${tenant_name}` : ""},</p>
        <p>Your <strong>${pass_type || "work pass"}</strong> is expiring on <strong>${expiry_date}</strong>.</p>
        <p>Please renew your pass and upload the updated document to avoid any disruption to your tenancy.</p>
        <p><a href="https://hyve.sg/portal/documents">Upload Updated Pass</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "ONBOARDING_COMPLETE": {
      const { tenant_name: name, room_code, property_name } = details;
      subject = "Welcome to the Hyve Community!";
      html = `
        <h2>You're All Set!</h2>
        <p>Hi${name ? ` ${name}` : ""},</p>
        <p>Your onboarding is complete and you're now an active member of the Hyve community${property_name ? ` at <strong>${property_name}</strong>` : ""}${room_code ? ` (Room ${room_code})` : ""}.</p>
        <p>Head to your dashboard to explore your portal, track AC usage, pay rent, and report issues.</p>
        <p><a href="https://hyve.sg/portal/dashboard">Go to Dashboard</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
      `;
      break;
    }
    case "INVOICE_ISSUED": {
      const tenantName = details.tenant_name || "there";
      subject = `Your Hyve invoice ${details.invoice_code} for $${details.amount} is ready`;
      html = `<p>Hi ${tenantName},</p>
    <p>Your invoice <strong>${details.invoice_code}</strong> for <strong>$${details.amount}</strong> is ready.</p>
    <p>Due date: ${details.due_date}</p>
    <p><a href="https://hyve.sg/portal/billing/${details.invoice_id}">View and pay in the portal</a></p>`;
      break;
    }
    case "INVOICE_UPDATED": {
      const tenantName = details.tenant_name || "there";
      subject = `Your invoice ${details.invoice_code} has been updated — new total: $${details.amount}`;
      html = `<p>Hi ${tenantName},</p>
    <p>Your invoice <strong>${details.invoice_code}</strong> has been updated with usage charges.</p>
    <p>New total: <strong>$${details.amount}</strong></p>
    <p><a href="https://hyve.sg/portal/billing/${details.invoice_id}">View details in the portal</a></p>`;
      break;
    }
    case "INVOICE_PAID": {
      const tenantName = details.tenant_name || "there";
      subject = `Payment received — invoice ${details.invoice_code} is now PAID`;
      html = `<p>Hi ${tenantName},</p>
    <p>We've received your payment of <strong>$${details.amount}</strong>.</p>
    <p>Invoice <strong>${details.invoice_code}</strong> is now fully paid. Thank you!</p>`;
      break;
    }
    case "INVOICE_OVERDUE": {
      const tenantName = details.tenant_name || "there";
      subject = `Invoice ${details.invoice_code} is overdue — late fee applied`;
      html = `<p>Hi ${tenantName},</p>
    <p>Your invoice <strong>${details.invoice_code}</strong> is <strong>${details.days_overdue} days overdue</strong>.</p>
    <p>A late fee of <strong>$${details.late_fee}</strong> has been applied.</p>
    <p>Please settle the outstanding amount as soon as possible.</p>
    <p><a href="https://hyve.sg/portal/billing/${details.invoice_id}">Pay now in the portal</a></p>`;
      break;
    }
    default:
      return new Response(JSON.stringify({ error: "Unknown event_type" }), {
        status: 400,
      });
  }

  await sendEmail(email, subject, html);
  return new Response(JSON.stringify({ sent: true, event_type, email }), {
    status: 200,
  });
  } catch (err) {
    console.error("notify-tenant error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err), stack: String(err?.stack || "") }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
