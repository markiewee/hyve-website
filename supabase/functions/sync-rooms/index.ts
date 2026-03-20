import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PROPERTIES = [
  {
    id: "d3e7e40f-a32c-4c8e-a54f-59e8f9cbc4a6",
    name: "Thomson Grove",
    code: "TG",
  },
  {
    id: "358c5333-00fd-4efb-b330-3d6e131e9b10",
    name: "Ivory Heights",
    code: "IH",
  },
  {
    id: "1d1cff29-0542-4520-bcf7-dfe0f7e8cb48",
    name: "Chiltern Park",
    code: "CP",
  },
];

Deno.serve(async (_req) => {
  // Connect to Millia Supabase
  const milliaUrl = Deno.env.get("MILLIA_SUPABASE_URL");
  const milliaKey = Deno.env.get("MILLIA_SUPABASE_ANON_KEY");

  if (!milliaUrl || !milliaKey) {
    return new Response(
      JSON.stringify({
        error: "MILLIA_SUPABASE_URL and MILLIA_SUPABASE_ANON_KEY are required",
      }),
      { status: 500 }
    );
  }

  const milliaSupabase = createClient(milliaUrl, milliaKey);

  // Upsert the 3 properties into local properties table
  const { error: propertiesError } = await supabase
    .from("properties")
    .upsert(
      PROPERTIES.map((p) => ({ id: p.id, name: p.name, code: p.code })),
      { onConflict: "id" }
    );

  if (propertiesError) {
    console.error("Failed to upsert properties:", propertiesError);
    return new Response(
      JSON.stringify({ error: "Failed to upsert properties", detail: propertiesError }),
      { status: 500 }
    );
  }

  const buildingIds = PROPERTIES.map((p) => p.id);

  // Fetch rooms from Millia's properties table
  const { data: milliaRooms, error: milliaError } = await milliaSupabase
    .from("properties")
    .select("*")
    .in("building_id", buildingIds);

  if (milliaError || !milliaRooms) {
    console.error("Failed to fetch rooms from Millia:", milliaError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch from Millia Supabase", detail: milliaError }),
      { status: 500 }
    );
  }

  if (milliaRooms.length === 0) {
    return new Response(
      JSON.stringify({ synced: 0, message: "No rooms found in Millia Supabase" }),
      { status: 200 }
    );
  }

  // Upsert into local rooms table
  const { error: roomsError } = await supabase
    .from("rooms")
    .upsert(milliaRooms, { onConflict: "id" });

  if (roomsError) {
    console.error("Failed to upsert rooms:", roomsError);
    return new Response(
      JSON.stringify({ error: "Failed to upsert rooms", detail: roomsError }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ synced: milliaRooms.length, properties_upserted: PROPERTIES.length }),
    { status: 200 }
  );
});
