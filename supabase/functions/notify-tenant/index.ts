import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const NOTIFY_URL =
  Deno.env.get("NOTIFY_URL") || "https://hyve.sg/api/portal/notify";
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET") || "";

async function sendEmail(to: string, subject: string, html: string) {
  await fetch(NOTIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-notify-secret": NOTIFY_SECRET,
    },
    body: JSON.stringify({ to, subject, html }),
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
