import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const OFFLINE_THRESHOLD_MINUTES = 20;

Deno.serve(async (_req) => {
  const now = new Date();
  const offlineThreshold = new Date(
    now.getTime() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000
  ).toISOString();

  // Fetch all room IDs
  const { data: allRooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id");

  if (roomsError || !allRooms) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch rooms", detail: roomsError }),
      { status: 500 }
    );
  }

  const allRoomIds = new Set(allRooms.map((r) => r.id));

  // Fetch device_status for all rooms
  const { data: deviceStatuses, error: statusError } = await supabase
    .from("device_status")
    .select("room_id, last_heartbeat, last_state");

  if (statusError) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch device_status", detail: statusError }),
      { status: 500 }
    );
  }

  const statusByRoom = new Map(
    (deviceStatuses ?? []).map((d) => [d.room_id, d])
  );

  const offline: {
    room_id: string;
    last_heartbeat: string;
    last_state: string;
    minutes_since_heartbeat: number;
  }[] = [];

  const neverConnected: { room_id: string }[] = [];

  for (const room of allRooms) {
    const status = statusByRoom.get(room.id);

    if (!status) {
      // Room has no device_status entry — never connected
      neverConnected.push({ room_id: room.id });
      continue;
    }

    if (status.last_heartbeat < offlineThreshold) {
      const lastHeartbeatDate = new Date(status.last_heartbeat);
      const minutesSince = Math.floor(
        (now.getTime() - lastHeartbeatDate.getTime()) / (1000 * 60)
      );
      offline.push({
        room_id: room.id,
        last_heartbeat: status.last_heartbeat,
        last_state: status.last_state,
        minutes_since_heartbeat: minutesSince,
      });
    }
  }

  return new Response(
    JSON.stringify({
      offline,
      never_connected: neverConnected,
      checked_at: now.toISOString(),
      total_rooms: allRooms.length,
      online_count: allRooms.length - offline.length - neverConnected.length,
    }),
    { status: 200 }
  );
});
