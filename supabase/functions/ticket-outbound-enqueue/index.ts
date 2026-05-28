// DB-webhook handler: turns a maintenance_tickets INSERT/UPDATE into a row in
// partner_outbound_queue so the worker can ship it to Millia.
//
// Endpoint:    POST /functions/v1/ticket-outbound-enqueue
// Source:      Supabase database webhook on maintenance_tickets (INSERT, UPDATE).
//              Standard payload shape: { type, table, schema, record, old_record }.
// Filter:      Only enqueues when record.last_sync_source = 'local'. This is
//              the echo-prevention guard — inbound writes stamp 'partner_inbound'
//              and never re-emit.
// Events:      INSERT → ticket.created. UPDATE → ticket.updated, or ticket.closed
//              if the new status is RESOLVED (canonical: resolved).
// Idempotency: delivery_id is deterministically derived from
//              SHA-256("{ticket_id}.{event}.{updated_at}"). Re-firing the DB
//              webhook for the same row state will produce the same delivery_id
//              and INSERT will be no-op'd by the PK conflict.
//
// Spec: docs/integrations/millia-handshake-v1.md (v1).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Local status → canonical status mapping.
const STATUS_MAP: Record<string, string> = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  ESCALATED: "on_hold",
  RESOLVED: "resolved",
};

interface TicketRecord {
  id: string;
  room_id: string;
  property_id: string;
  status: string;
  category: string;
  description: string | null;
  resolution_note: string | null;
  assigned_to: string | null;
  last_sync_source: string;
  created_at: string;
  updated_at: string;
}

interface DbWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: TicketRecord | null;
  old_record: TicketRecord | null;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Stable UUID v4-shape derived from SHA-256 hex. Not RFC-compliant v5, but
// stable + uniqueness is what we need for the PK idempotency guard.
function uuidFromHash(hex: string): string {
  const h = hex.padEnd(32, "0").slice(0, 32);
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "4" + h.slice(13, 16),
    "8" + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let payload: DbWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (payload.table !== "maintenance_tickets") {
    return json(200, { skipped: "wrong_table" });
  }
  if (payload.type !== "INSERT" && payload.type !== "UPDATE") {
    return json(200, { skipped: "wrong_op" });
  }

  const record = payload.record;
  if (!record) return json(200, { skipped: "no_record" });

  // Echo prevention: only emit on locally-sourced writes.
  if (record.last_sync_source !== "local") {
    return json(200, { skipped: "non_local_source", source: record.last_sync_source });
  }

  // Skip pure no-op updates (UPDATE with no status / description / resolution change).
  if (payload.type === "UPDATE" && payload.old_record) {
    const o = payload.old_record;
    const noopFields = [
      o.status === record.status,
      o.description === record.description,
      o.resolution_note === record.resolution_note,
      o.assigned_to === record.assigned_to,
    ];
    if (noopFields.every(Boolean)) {
      return json(200, { skipped: "noop_update" });
    }
  }

  // Determine event.
  let event: "ticket.created" | "ticket.updated" | "ticket.closed";
  if (payload.type === "INSERT") {
    event = "ticket.created";
  } else if (record.status === "RESOLVED") {
    event = "ticket.closed";
  } else {
    event = "ticket.updated";
  }

  const canonicalStatus = STATUS_MAP[record.status] ?? "open";

  // Fetch room + property + photos for the full envelope.
  const [{ data: room }, { data: property }, { data: photos }] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, unit_code")
      .eq("id", record.room_id)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, name, code")
      .eq("id", record.property_id)
      .maybeSingle(),
    supabase
      .from("ticket_photos")
      .select("photo_url")
      .eq("ticket_id", record.id),
  ]);

  let assignee: { name: string; role: string } | null = null;
  if (record.assigned_to) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", record.assigned_to)
      .maybeSingle();
    if (profile) {
      assignee = {
        name: profile.full_name ?? "",
        role: profile.role ?? "",
      };
    }
  }

  const envelope = {
    event,
    delivery_id: "", // filled below
    occurred_at: new Date().toISOString(),
    ticket: {
      id: record.id,
      status: canonicalStatus,
      category: record.category,
      description: record.description,
      room: {
        id: room?.id ?? record.room_id,
        unit_code: room?.unit_code ?? null,
        property_code: property?.code ?? null,
        property_name: property?.name ?? null,
      },
      assignee,
      notes: record.resolution_note,
      photos: (photos ?? []).map((p: { photo_url: string }) => ({
        url: p.photo_url,
      })),
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
    meta: {
      source: "lazybee_partner",
      schema_version: 1,
    },
  };

  const deliveryId = uuidFromHash(
    await sha256Hex(`${record.id}.${event}.${record.updated_at}`),
  );
  envelope.delivery_id = deliveryId;

  const { error: insertErr } = await supabase
    .from("partner_outbound_queue")
    .insert({
      delivery_id: deliveryId,
      partner: "millia",
      ticket_id: record.id,
      event,
      payload: envelope,
      next_attempt_at: new Date().toISOString(),
    });

  if (insertErr) {
    // PK conflict → already enqueued, treat as success.
    if (insertErr.code === "23505") {
      return json(200, { enqueued: false, duplicate: true, delivery_id: deliveryId });
    }
    console.error("[ticket-outbound-enqueue] insert failed", insertErr);
    return json(500, { error: "enqueue_failed", detail: insertErr.message });
  }

  return json(200, { enqueued: true, delivery_id: deliveryId, event });
});
