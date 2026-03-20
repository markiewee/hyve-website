import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ESCALATION_THRESHOLD_HOURS = 48;

Deno.serve(async (_req) => {
  const now = new Date();
  const escalationCutoff = new Date(
    now.getTime() - ESCALATION_THRESHOLD_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Find open tickets older than 48 hours
  const { data: tickets, error: fetchError } = await supabase
    .from("maintenance_tickets")
    .select("id, room_id, subject, created_at")
    .eq("status", "OPEN")
    .lt("created_at", escalationCutoff);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch tickets", detail: fetchError }),
      { status: 500 }
    );
  }

  if (!tickets || tickets.length === 0) {
    return new Response(
      JSON.stringify({ escalated: 0, summary: "No tickets require escalation." }),
      { status: 200 }
    );
  }

  const ticketIds = tickets.map((t) => t.id);

  // Update status to ESCALATED
  const { error: updateError } = await supabase
    .from("maintenance_tickets")
    .update({ status: "ESCALATED", escalated_at: now.toISOString() })
    .in("id", ticketIds);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to escalate tickets", detail: updateError }),
      { status: 500 }
    );
  }

  // Build WhatsApp-friendly summary
  const ticketLines = tickets
    .map((t) => {
      const ageHours = Math.floor(
        (now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60)
      );
      return `• Room ${t.room_id}: "${t.subject}" (${ageHours}h old)`;
    })
    .join("\n");

  const summary =
    `${tickets.length} ticket${tickets.length > 1 ? "s" : ""} escalated (open >48h):\n` +
    ticketLines;

  return new Response(
    JSON.stringify({ escalated: tickets.length, summary }),
    { status: 200 }
  );
});
