import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  let body: {
    device_api_key?: string;
    room_id?: string;
    state?: string;
    source?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
    });
  }

  const { device_api_key, room_id, state, source } = body;

  if (!device_api_key || !room_id || !state || !source) {
    return new Response(
      JSON.stringify({
        error: "device_api_key, room_id, state, and source are required",
      }),
      { status: 400 }
    );
  }

  // Validate state and source enums
  if (!["ON", "OFF"].includes(state)) {
    return new Response(
      JSON.stringify({ error: "state must be ON or OFF" }),
      { status: 400 }
    );
  }

  if (!["STATE_CHANGE", "HEARTBEAT"].includes(source)) {
    return new Response(
      JSON.stringify({ error: "source must be STATE_CHANGE or HEARTBEAT" }),
      { status: 400 }
    );
  }

  // Validate device_api_key against device_keys table
  const { data: deviceKey, error: deviceKeyError } = await supabase
    .from("device_keys")
    .select("id, room_id, is_active")
    .eq("api_key", device_api_key)
    .single();

  if (deviceKeyError || !deviceKey) {
    return new Response(
      JSON.stringify({ error: "Invalid device_api_key" }),
      { status: 401 }
    );
  }

  if (!deviceKey.is_active) {
    return new Response(
      JSON.stringify({ error: "Device key is inactive" }),
      { status: 403 }
    );
  }

  if (deviceKey.room_id !== room_id) {
    return new Response(
      JSON.stringify({ error: "device_api_key does not match room_id" }),
      { status: 403 }
    );
  }

  const now = new Date().toISOString();

  // Insert ac_event
  const { error: insertError } = await supabase.from("ac_events").insert({
    room_id,
    state,
    source,
    timestamp: now,
  });

  if (insertError) {
    console.error("Failed to insert ac_event:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to record event" }),
      { status: 500 }
    );
  }

  // Upsert device_status
  const { error: upsertError } = await supabase
    .from("device_status")
    .upsert(
      {
        room_id,
        last_heartbeat: now,
        last_state: state,
      },
      { onConflict: "room_id" }
    );

  if (upsertError) {
    console.error("Failed to upsert device_status:", upsertError);
    // Non-fatal — event was already recorded
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
