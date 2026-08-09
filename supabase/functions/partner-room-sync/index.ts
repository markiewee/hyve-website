// Bootstrap endpoint: upserts partner ↔ local room mappings.
//
// Endpoint:    POST /functions/v1/partner-room-sync
// Auth:        Bearer JWT in Authorization. The caller must have role ADMIN
//              (via profiles.role / get_user_role). NOT signature-gated — this
//              is a tooling endpoint, not part of the webhook handshake.
//
// Body:
//   {
//     "partner": "millia",                  // optional, defaults to "millia"
//     "rooms": [
//       {
//         "partner_room_id": "uuid",        // required
//         "partner_unit_code": "CP-MBR",    // optional
//         "millia_property_id": "uuid",     // optional
//         "room_id": "<our rooms.id uuid>"  // required — we resolve this on our side
//       }
//     ]
//   }
//
// Behaviour:   Upsert each row on PK (partner, partner_room_id). Touches
//              updated_at. Returns counts of inserted/updated/skipped.
//
// Spec: docs/integrations/millia-handshake-v1.md (v1).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function isAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);

  // Verify the JWT via Supabase auth.
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  return profile?.role === "ADMIN";
}

interface InboundRow {
  partner_room_id?: string;
  partner_unit_code?: string;
  millia_property_id?: string;
  room_id?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  if (!(await isAdmin(req.headers.get("Authorization")))) {
    return json(401, { error: "admin_only" });
  }

  let body: { partner?: string; rooms?: InboundRow[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const partner = body.partner ?? "millia";
  const rooms = Array.isArray(body.rooms) ? body.rooms : [];
  if (rooms.length === 0) return json(400, { error: "rooms_required" });

  const toUpsert: Record<string, unknown>[] = [];
  const skipped: { reason: string; row: InboundRow }[] = [];

  for (const r of rooms) {
    if (!r.partner_room_id || !r.room_id) {
      skipped.push({ reason: "missing_required_fields", row: r });
      continue;
    }
    toUpsert.push({
      partner,
      partner_room_id: r.partner_room_id,
      partner_unit_code: r.partner_unit_code ?? null,
      millia_property_id: r.millia_property_id ?? null,
      room_id: r.room_id,
      updated_at: new Date().toISOString(),
    });
  }

  if (toUpsert.length === 0) {
    return json(400, { error: "no_valid_rows", skipped });
  }

  const { data, error } = await supabase
    .from("partner_property_mappings")
    .upsert(toUpsert, { onConflict: "partner,partner_room_id" })
    .select("partner_room_id");

  if (error) {
    return json(500, { error: "upsert_failed", detail: error.message });
  }

  return json(200, {
    upserted: data?.length ?? 0,
    skipped,
  });
});
