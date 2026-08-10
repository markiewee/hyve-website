// scripts/mint-partner-key.mjs
//
// Mint an API key for a partner channel. Creates the channel row if the slug
// does not exist (mechanism 'api', enabled FALSE: a human flips the kill
// switch after commercials are agreed). Prints the key ONCE; only the hash
// is stored.
//
// Usage:
//   node scripts/mint-partner-key.mjs <channel-slug> "<Partner Name>" [label]
// Env: VITE_IOT_SUPABASE_URL, IOT_SUPABASE_SERVICE_ROLE_KEY (same as api/).

import { createClient } from "@supabase/supabase-js";
import { mintKey, hashKey } from "../src/lib/partnerAuth.js";

const [slug, name, label = "default"] = process.argv.slice(2);
if (!slug || !name) {
  console.error('Usage: node scripts/mint-partner-key.mjs <channel-slug> "<Partner Name>" [label]');
  process.exit(1);
}
if (!process.env.VITE_IOT_SUPABASE_URL || !process.env.IOT_SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing VITE_IOT_SUPABASE_URL or IOT_SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(process.env.VITE_IOT_SUPABASE_URL, process.env.IOT_SUPABASE_SERVICE_ROLE_KEY);

let { data: channel, error: chErr } = await supabase
  .from("listing_channels").select("id, slug, enabled").eq("slug", slug).maybeSingle();
if (chErr) { console.error("channel lookup failed:", chErr.message); process.exit(1); }
if (!channel) {
  const ins = await supabase
    .from("listing_channels")
    .insert({ slug, name, mechanism: "api", enabled: false })
    .select("id, slug, enabled")
    .single();
  if (ins.error) { console.error("channel create failed:", ins.error.message); process.exit(1); }
  channel = ins.data;
  console.log(`created channel ${slug} (enabled=false; flip it when commercials are signed)`);
}

const key = mintKey();
const { error } = await supabase.from("channel_api_keys").insert({ channel_id: channel.id, key_hash: hashKey(key), label });
if (error) { console.error("insert failed:", error.message); process.exit(1); }

console.log(`\nPartner:  ${name} (${slug})`);
console.log(`Label:    ${label}`);
console.log(`API key (shown once, store it now):\n\n  ${key}\n`);
console.log(`Channel enabled: ${channel.enabled}. Rates: set commission on listing_channels to activate channel pricing.`);
