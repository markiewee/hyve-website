import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ARCHIVE_MONTHS_AGO = 3;
const BATCH_LIMIT = 10000;
const STORAGE_BUCKET = "ticket-photos";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Escape commas and quotes
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

Deno.serve(async (_req) => {
  const now = new Date();
  const archiveCutoff = new Date(
    now.getFullYear(),
    now.getMonth() - ARCHIVE_MONTHS_AGO,
    1
  ).toISOString();

  // Fetch events older than 3 months
  const { data: events, error: fetchError } = await supabase
    .from("ac_events")
    .select("*")
    .lt("timestamp", archiveCutoff)
    .order("timestamp", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch ac_events", detail: fetchError }),
      { status: 500 }
    );
  }

  if (!events || events.length === 0) {
    return new Response(
      JSON.stringify({ archived: 0, file: null, message: "No events to archive" }),
      { status: 200 }
    );
  }

  // Convert to CSV
  const csv = toCSV(events as Record<string, unknown>[]);
  const csvBytes = new TextEncoder().encode(csv);

  // Build filename: archives/ac_events_YYYY-MM-DD_HH-MM-SS.csv
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const filename = `archives/ac_events_${timestamp}.csv`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, csvBytes, {
      contentType: "text/csv",
      upsert: false,
    });

  if (uploadError) {
    console.error("Failed to upload archive:", uploadError);
    return new Response(
      JSON.stringify({ error: "Failed to upload archive to storage", detail: uploadError }),
      { status: 500 }
    );
  }

  // Delete the archived events
  const eventIds = events.map((e) => e.id);
  const { error: deleteError } = await supabase
    .from("ac_events")
    .delete()
    .in("id", eventIds);

  if (deleteError) {
    console.error("Failed to delete archived events:", deleteError);
    return new Response(
      JSON.stringify({
        error: "Archive uploaded but delete failed — manual cleanup required",
        file: filename,
        archived: 0,
        detail: deleteError,
      }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ archived: events.length, file: filename }),
    { status: 200 }
  );
});
