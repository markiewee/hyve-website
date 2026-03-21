// NOTE: The pending_notifications table must be created before this function
// will insert WhatsApp notifications. Run this SQL once in Supabase:
//
// CREATE TABLE IF NOT EXISTS pending_notifications (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL')),
//   recipient TEXT NOT NULL,
//   message TEXT NOT NULL,
//   status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
//   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Admin full access notifications" ON pending_notifications FOR ALL
//   USING (get_user_role(auth.uid()) = 'ADMIN');

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
    .select(
      "id, room_id, category, description, subject, created_at, rooms(unit_code, properties(name))"
    )
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

  // Store WhatsApp notifications for Claudine's cron to pick up and send to Momo
  for (const ticket of tickets) {
    const unitCode = (ticket as any).rooms?.unit_code ?? `room ${ticket.room_id}`;
    const propertyName = (ticket as any).rooms?.properties?.name ?? "Unknown Property";
    const category = (ticket as any).category ?? ticket.subject ?? "Issue";
    const description = ((ticket as any).description ?? ticket.subject ?? "")
      .slice(0, 100);

    const { error: notifError } = await supabase
      .from("pending_notifications")
      .insert({
        channel: "WHATSAPP",
        recipient: "+6591340889", // Momo
        message:
          `⚠️ Ticket auto-escalated (48h no action)\n` +
          `${unitCode} (${propertyName})\n` +
          `${category}: ${description}`,
        status: "PENDING",
      });

    if (notifError) {
      console.error(
        `Failed to insert pending_notification for ticket ${ticket.id}:`,
        notifError
      );
    }
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
