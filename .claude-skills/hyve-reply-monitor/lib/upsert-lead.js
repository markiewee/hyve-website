// lib/upsert-lead.js
import { createClient } from "@supabase/supabase-js";

const FIELDS = [
  "chat_id", "name", "phone", "source", "intent",
  "matched_room_codes", "status", "last_message_at",
  "last_reply_at", "last_message_excerpt", "notes",
];

export function buildUpsertPayload(input) {
  if (!input.chat_id) throw new Error("chat_id required");
  const payload = {};
  for (const f of FIELDS) {
    if (input[f] !== undefined) payload[f] = input[f];
  }
  return payload;
}

export async function upsertLead(input, { supabaseUrl, supabaseKey }) {
  const payload = buildUpsertPayload(input);
  const sb = createClient(supabaseUrl, supabaseKey);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await sb
      .from("leads")
      .upsert(payload, { onConflict: "chat_id" })
      .select()
      .single();
    if (!error) return data;
    if (attempt === 1) throw error;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.find((a) => a.startsWith("--payload="));
  if (!arg) {
    console.error("Usage: --payload=<json>");
    process.exit(1);
  }
  const input = JSON.parse(arg.slice("--payload=".length));
  const url = process.env.SUPABASE_URL || "https://diiilqpfmlxjwiaeophb.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  upsertLead(input, { supabaseUrl: url, supabaseKey: key })
    .then((row) => console.log(JSON.stringify(row, null, 2)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
