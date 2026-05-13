// scripts/seed-leads.mjs
// Insert ~6 fake leads spanning pipeline statuses for portal dev.
// Idempotent: uses upsert on chat_id.
//
// Run:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/seed-leads.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://diiilqpfmlxjwiaeophb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY before running");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const now = Date.now();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

const seeds = [
  {
    chat_id: "seed-001",
    name: "Alex Chen (seed)",
    phone: "+6591110001",
    source: "airbnb",
    intent: { room_type: "standard", budget_max: 1200, move_in_date: "2026-06-15", profile_notes: "Singaporean, working at Grab" },
    matched_room_codes: ["IH-STD2"],
    status: "new",
    last_message_at: daysAgo(0.1),
    last_message_excerpt: "Hi! Saw your listing — any std rooms in IH for June?",
  },
  {
    chat_id: "seed-002",
    name: "Priya N (seed)",
    phone: "+6591110002",
    source: "propertyguru",
    intent: { room_type: "premium", budget_max: 1500, move_in_date: "2026-06-01" },
    matched_room_codes: ["CP-PR2"],
    status: "qualified",
    last_message_at: daysAgo(1),
    last_message_excerpt: "OK budget is 1500 max — any premium rooms?",
  },
  {
    chat_id: "seed-003",
    name: "Marcus L (seed)",
    phone: "+6591110003",
    source: "carousell",
    intent: { room_type: "master", budget_max: 2500 },
    matched_room_codes: ["TG-MR"],
    status: "viewing_booked",
    last_message_at: daysAgo(2),
    last_message_excerpt: "Confirmed viewing Friday 7pm",
  },
  {
    chat_id: "seed-004",
    name: "Anna K (seed)",
    phone: "+6591110004",
    source: "roomies",
    intent: { room_type: "standard", budget_max: 1000 },
    matched_room_codes: ["IH-STD3"],
    status: "viewing_done",
    last_message_at: daysAgo(4),
    last_message_excerpt: "Thanks for the viewing today!",
  },
  {
    chat_id: "seed-005",
    name: "Raj P (seed)",
    phone: "+6591110005",
    source: "agent_referral",
    intent: { room_type: "premium", budget_max: 1400 },
    matched_room_codes: ["CP-PR1"],
    status: "agreement_sent",
    last_message_at: daysAgo(3),
    last_message_excerpt: "Got the TA, reviewing with my wife",
  },
  {
    chat_id: "seed-006",
    name: "Stale lead (seed)",
    phone: "+6591110006",
    source: "other",
    intent: { room_type: "standard", budget_max: 900 },
    matched_room_codes: [],
    status: "qualified",
    last_message_at: daysAgo(20),
    last_message_excerpt: "Will let you know soon",
  },
];

const { data, error } = await sb
  .from("leads")
  .upsert(seeds, { onConflict: "chat_id" })
  .select();

if (error) {
  console.error("Upsert failed:", error);
  process.exit(1);
}

console.log(`Seeded ${data.length} leads`);
for (const row of data) console.log(`  - ${row.chat_id} | ${row.name} | ${row.status}`);
