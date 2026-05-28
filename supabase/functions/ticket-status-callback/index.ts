// Inbound webhook: Millia → Lazybee.
//
// Endpoint:   POST /functions/v1/ticket-status-callback
// Auth:       HMAC-SHA256 over "{timestamp}.{raw_body}", header
//             X-Millia-Signature: sha256=<hex>. Timestamp in X-Millia-Timestamp.
//             Shared secret = env MILLIA_PARTNER_SECRET.
// Replay:    |now - timestamp| > 300s → 401 stale_timestamp.
// Idempotent: X-Millia-Delivery-Id (or payload.delivery_id) checked against
//             partner_inbound_log — repeats return duplicate=true.
//
// Spec: docs/integrations/millia-handshake-v1.md (v1).
//
// Events accepted: ticket.updated, ticket.closed.
// Behaviour: After signature + replay + dedup, INSERT into partner_inbound_log
// (status=pending) and immediately 200. A separate worker applies the update to
// maintenance_tickets (TODO: implement as a Supabase scheduled function — see
// the Celery-equivalent on Jason's side).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// TODO: rename LAZYBEE_WEBHOOK_SECRET → MILLIA_PARTNER_SECRET on the project,
// or share the value with Jason during integration. Fall back for now so the
// already-set secret keeps working until rename.
const SECRET =
  Deno.env.get("MILLIA_PARTNER_SECRET") ??
  Deno.env.get("LAZYBEE_WEBHOOK_SECRET") ??
  "";

const REPLAY_WINDOW_SECONDS = 300;
const ACCEPTED_EVENTS = new Set(["ticket.updated", "ticket.closed"]);
const CANONICAL_STATUSES = new Set([
  "open",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(
  timestamp: string,
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  if (!SECRET) return false;
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length).toLowerCase();
  const actual = await hmacHex(SECRET, `${timestamp}.${rawBody}`);
  return constantTimeEqual(actual, expected);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const signature = req.headers.get("X-Millia-Signature");
  const timestampHeader = req.headers.get("X-Millia-Timestamp");
  const deliveryHeader = req.headers.get("X-Millia-Delivery-Id");
  const rawBody = await req.text();

  // --- timestamp / replay window -------------------------------------------
  const ts = Number(timestampHeader);
  if (!timestampHeader || !Number.isFinite(ts)) {
    return json(401, { error: "stale_timestamp" });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > REPLAY_WINDOW_SECONDS) {
    return json(401, { error: "stale_timestamp" });
  }

  // --- signature ------------------------------------------------------------
  if (!(await verifySignature(timestampHeader, rawBody, signature))) {
    return json(401, { error: "invalid_signature" });
  }

  // --- parse body -----------------------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(422, { error: "schema_violation", detail: "invalid_json" });
  }

  const deliveryId =
    deliveryHeader ?? (payload.delivery_id ? String(payload.delivery_id) : "");
  const event = String(payload.event ?? "");
  const ticket = (payload.ticket ?? {}) as Record<string, unknown>;
  const ticketId = ticket.id ? String(ticket.id) : null;
  const canonicalStatus = ticket.status ? String(ticket.status) : null;

  if (!deliveryId) {
    return json(422, { error: "schema_violation", detail: "missing_delivery_id" });
  }
  if (!ACCEPTED_EVENTS.has(event)) {
    return json(422, {
      error: "schema_violation",
      detail: `unsupported_event: ${event}`,
    });
  }
  if (!ticketId) {
    return json(422, { error: "schema_violation", detail: "missing_ticket_id" });
  }
  if (!canonicalStatus || !CANONICAL_STATUSES.has(canonicalStatus)) {
    return json(422, {
      error: "schema_violation",
      detail: `invalid_status: ${canonicalStatus}`,
    });
  }

  // --- idempotency check ---------------------------------------------------
  const { data: existing } = await supabase
    .from("partner_inbound_log")
    .select("status")
    .eq("delivery_id", deliveryId)
    .maybeSingle();

  if (existing) {
    const body: Record<string, unknown> = {
      received: true,
      delivery_id: deliveryId,
      duplicate: true,
    };
    if (existing.status === "unmapped") body.status = "unmapped";
    return json(200, body);
  }

  // --- resolve ticket → mapped? --------------------------------------------
  const { data: localTicket } = await supabase
    .from("maintenance_tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!localTicket) {
    // Don't reject — config drift shouldn't trigger retry storms.
    await supabase.from("partner_inbound_log").insert({
      delivery_id: deliveryId,
      partner: "millia",
      event,
      ticket_id: null,
      payload,
      status: "unmapped",
      processed_at: new Date().toISOString(),
    });
    return json(200, {
      received: true,
      delivery_id: deliveryId,
      duplicate: false,
      status: "unmapped",
    });
  }

  // --- enqueue: write pending row, return 200 ------------------------------
  // The worker (TODO: Supabase scheduled function) will pick this up, map the
  // canonical status → local enum, update maintenance_tickets, and stamp
  // last_sync_source='partner_inbound' to prevent the outbound trigger from
  // echoing it back.
  const { error: insertErr } = await supabase
    .from("partner_inbound_log")
    .insert({
      delivery_id: deliveryId,
      partner: "millia",
      event,
      ticket_id: ticketId,
      payload,
      status: "pending",
    });

  if (insertErr) {
    // Unique-violation race on delivery_id: treat as duplicate.
    if (insertErr.code === "23505") {
      return json(200, {
        received: true,
        delivery_id: deliveryId,
        duplicate: true,
      });
    }
    console.error("[ticket-status-callback] enqueue failed", insertErr);
    return json(500, { error: "enqueue_failed", detail: insertErr.message });
  }

  return json(200, {
    received: true,
    delivery_id: deliveryId,
    duplicate: false,
  });
});
