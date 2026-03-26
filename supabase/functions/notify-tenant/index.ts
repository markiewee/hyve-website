import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const NOTIFY_URL =
  Deno.env.get("NOTIFY_URL") || "https://hyve.sg/api/portal/admin-actions";
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET") || "";

async function sendEmail(to: string, subject: string, html: string) {
  await fetch(NOTIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-notify-secret": NOTIFY_SECRET,
    },
    body: JSON.stringify({ action: "notify", to, subject, html }),
  });
}

async function getTenantEmail(tenantProfileId: string): Promise<string | null> {
  const { data } = await supabase
    .from("tenant_profiles")
    .select("user_id")
    .eq("id", tenantProfileId)
    .single();
  if (!data?.user_id) return null;

  const { data: userData } = await supabase.auth.admin.getUserById(
    data.user_id
  );
  return userData?.user?.email || null;
}

Deno.serve(async (req) => {
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
      const { ticket_category, new_status, resolution_note } = details;
      subject = `Issue Update: ${ticket_category} — ${new_status}`;
      html = `
        <h2>Your maintenance ticket has been updated</h2>
        <p><strong>Category:</strong> ${ticket_category}</p>
        <p><strong>New Status:</strong> ${new_status}</p>
        ${resolution_note ? `<p><strong>Resolution:</strong> ${resolution_note}</p>` : ""}
        <p><a href="https://hyve.sg/portal/issues">View in Portal</a></p>
        <p style="color:#888;font-size:12px">— Hyve Co-Living</p>
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
    default:
      return new Response(JSON.stringify({ error: "Unknown event_type" }), {
        status: 400,
      });
  }

  await sendEmail(email, subject, html);
  return new Response(JSON.stringify({ sent: true, event_type }), {
    status: 200,
  });
});
