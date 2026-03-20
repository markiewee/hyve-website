import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function calculateHours(
  events: { state: string; timestamp: string }[],
  periodEnd: Date
): number {
  let totalMs = 0;
  let onStart: Date | null = null;

  for (const event of events) {
    const ts = new Date(event.timestamp);
    if (event.state === "ON") {
      if (!onStart) {
        onStart = ts;
      }
    } else if (event.state === "OFF") {
      if (onStart) {
        totalMs += ts.getTime() - onStart.getTime();
        onStart = null;
      }
    }
  }

  // If still ON at period end, count up to now
  if (onStart) {
    totalMs += periodEnd.getTime() - onStart.getTime();
  }

  return totalMs / (1000 * 60 * 60);
}

Deno.serve(async (_req) => {
  // Fetch all rooms
  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id");

  if (roomsError || !rooms) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch rooms", detail: roomsError }),
      { status: 500 }
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const results: { room_id: string; total_hours: number; month: string }[] = [];

  for (const room of rooms) {
    const { data: events, error: eventsError } = await supabase
      .from("ac_events")
      .select("state, timestamp")
      .eq("room_id", room.id)
      .gte("timestamp", monthStart)
      .order("timestamp", { ascending: true });

    if (eventsError) {
      console.error(`Failed to fetch events for room ${room.id}:`, eventsError);
      continue;
    }

    const totalHours = calculateHours(events ?? [], now);

    // Upsert ac_monthly_usage
    const { error: upsertError } = await supabase
      .from("ac_monthly_usage")
      .upsert(
        {
          room_id: room.id,
          month: monthLabel,
          total_hours: totalHours,
        },
        { onConflict: "room_id,month" }
      );

    if (upsertError) {
      console.error(
        `Failed to upsert ac_monthly_usage for room ${room.id}:`,
        upsertError
      );
    }

    results.push({ room_id: room.id, total_hours: totalHours, month: monthLabel });
  }

  return new Response(JSON.stringify({ results }), { status: 200 });
});
