// lib/query-rooms.js
import { createClient } from "@supabase/supabase-js";

export function matchRooms(rooms, intent) {
  return rooms.filter((room) => {
    if (intent.room_type && room.room_type !== intent.room_type) return false;
    if (intent.budget_max != null && room.monthly_rent > intent.budget_max) return false;
    if (intent.budget_min != null && room.monthly_rent < intent.budget_min) return false;
    if (
      intent.move_in_date &&
      room.available_from &&
      new Date(room.available_from) > new Date(intent.move_in_date)
    ) {
      return false;
    }
    return true;
  }).slice(0, 3);
}

export async function fetchAndMatch(intent, { supabaseUrl, supabaseKey }) {
  const sb = createClient(supabaseUrl, supabaseKey);
  const { data: rooms, error } = await sb.rpc("rooms_with_availability");
  if (error) throw error;
  return matchRooms(rooms || [], intent);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intentArg = process.argv.find((a) => a.startsWith("--intent="));
  if (!intentArg) {
    console.error("Usage: --intent=<json>");
    process.exit(1);
  }
  const intent = JSON.parse(intentArg.slice("--intent=".length));
  const url = process.env.SUPABASE_URL || "https://diiilqpfmlxjwiaeophb.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  fetchAndMatch(intent, { supabaseUrl: url, supabaseKey: key })
    .then((rows) => console.log(JSON.stringify(rows, null, 2)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
