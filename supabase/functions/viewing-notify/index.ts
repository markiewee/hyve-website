import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const NOTIFY_URL =
  Deno.env.get("NOTIFY_URL") || "https://lazybee.sg/api/portal/admin-actions";
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

Deno.serve(async (req) => {
  try {
    const { event, viewing_id } = await req.json();

    if (!viewing_id) {
      return new Response(JSON.stringify({ error: "viewing_id required" }), { status: 400 });
    }

    // Fetch viewing with property and room details
    const { data: viewing, error: viewErr } = await supabase
      .from("property_viewings")
      .select("*, properties(name, code, address), rooms(name, unit_code)")
      .eq("id", viewing_id)
      .single();

    if (viewErr || !viewing) {
      return new Response(JSON.stringify({ error: "Viewing not found" }), { status: 404 });
    }

    // Get captain's email
    let captainEmail: string | null = null;
    let captainName = "House Captain";

    if (viewing.captain_id) {
      const { data: captain } = await supabase
        .from("tenant_profiles")
        .select("user_id, tenant_details(full_name, email)")
        .eq("id", viewing.captain_id)
        .single();

      if (captain?.tenant_details?.email) {
        captainEmail = captain.tenant_details.email;
        captainName = captain.tenant_details.full_name || "House Captain";
      } else if (captain?.user_id) {
        // Fallback: get email from auth
        const { data: userData } = await supabase.auth.admin.getUserById(captain.user_id);
        captainEmail = userData?.user?.email || null;
      }
    }

    // Also always notify admin
    const adminEmail = "admin@lazybee.sg";

    // Format date
    const viewDate = new Date(viewing.viewing_date);
    const dateStr = viewDate.toLocaleDateString("en-SG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Format time
    const timeStr = viewing.viewing_time
      ? new Date(`2000-01-01T${viewing.viewing_time}`).toLocaleTimeString("en-SG", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "TBC";

    const propertyName = viewing.properties?.name || "Property";
    const roomName = viewing.rooms?.name || viewing.rooms?.unit_code || "Any available room";
    const prospectName = viewing.prospect_name || "A prospect";

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #006b5f; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">New Viewing Request</h1>
          <p style="color: #71f8e4; margin: 8px 0 0; font-size: 14px;">Can you be there?</p>
        </div>
        <div style="padding: 32px; background: white;">
          <p style="font-size: 16px; color: #121c2a;">Hi ${captainName},</p>
          <p style="font-size: 15px; color: #3c4947;">A prospect has booked a viewing at your property. Can you be there?</p>
          <div style="background: #f8f9ff; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <table style="width: 100%; font-size: 14px; color: #121c2a;">
              <tr><td style="padding: 8px 0; color: #6c7a77; font-weight: 700;">When:</td><td style="padding: 8px 0;">${dateStr}, ${timeStr}</td></tr>
              <tr><td style="padding: 8px 0; color: #6c7a77; font-weight: 700;">Property:</td><td style="padding: 8px 0;">${propertyName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6c7a77; font-weight: 700;">Room:</td><td style="padding: 8px 0;">${roomName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6c7a77; font-weight: 700;">Prospect:</td><td style="padding: 8px 0;">${prospectName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6c7a77; font-weight: 700;">Type:</td><td style="padding: 8px 0;">${viewing.viewing_type === "virtual" ? "Virtual Viewing" : "In-Person Viewing"}</td></tr>
            </table>
          </div>
          <p style="font-size: 13px; color: #6c7a77;">You can manage viewings from your portal at <a href="https://lazybee.sg/portal/viewings" style="color: #006b5f;">lazybee.sg/portal/viewings</a></p>
          <p style="font-size: 12px; color: #bbcac6; margin-top: 24px;">— Hyve Co-Living</p>
        </div>
      </div>
    `;

    const subject = `New Viewing: ${prospectName} at ${propertyName} — ${dateStr}`;

    // Send to captain
    if (captainEmail) {
      await sendEmail(captainEmail, subject, emailHtml);
    }

    // Always CC admin
    await sendEmail(adminEmail, subject, emailHtml);

    return new Response(
      JSON.stringify({
        sent: true,
        captain_email: captainEmail,
        admin_email: adminEmail,
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
