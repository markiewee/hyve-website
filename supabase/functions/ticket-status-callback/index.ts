// Inbound webhook: external automation backend (n8n, custom worker, etc.) POSTs
// here to update the status / assignment / resolution of a maintenance ticket.
//
// Endpoint:   POST /functions/v1/ticket-status-callback
// Auth:       HMAC-SHA256 over the raw request body, header X-Lazybee-Signature
//             format "sha256=<hex>". Shared secret is the env var
//             LAZYBEE_WEBHOOK_SECRET, set on both sides.
// Idempotent: X-Lazybee-Delivery (UUID) is checked against webhook_deliveries —
//             repeats return the original result without re-applying the update.
//
// Body shape:
// {
//   "ticket_id": "uuid",
//   "status": "IN_PROGRESS" | "ESCALATED" | "RESOLVED",
//   "assigned_to_email": "captain@navid.sg",   // optional
//   "resolution_note": "Replaced compressor",  // required when status=RESOLVED
//   "internal_ref": "navid-#4823",             // optional, backend's own ID
//   "occurred_at": "2026-05-28T10:30:00Z",     // optional
//   "meta": { "actor": "alam@navid.sg" }       // optional, free-form
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SECRET = Deno.env.get("LAZYBEE_WEBHOOK_SECRET") ?? "";
const SOURCE = "ticket-status-callback";

const VALID_STATUSES = new Set(["IN_PROGRESS", "ESCALATED", "RESOLVED"]);

// status transitions a webhook is allowed to apply.
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  OPEN: new Set(["IN_PROGRESS", "ESCALATED", "RESOLVED"]),
  IN_PROGRESS: new Set(["ESCALATED", "RESOLVED"]),
  ESCALATED: new Set(["IN_PROGRESS", "RESOLVED"]),
  RESOLVED: new Set(), // terminal — re-open must go through admin UI
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!SECRET) return false;
  if (!header || !header.startsWith("sha256=")) return false;
  const expectedHex = header.slice("sha256=".length).toLowerCase();

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const actualHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare.
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const deliveryId = req.headers.get("X-Lazybee-Delivery");
  const signature = req.headers.get("X-Lazybee-Signature");
  const rawBody = await req.text();

  if (!deliveryId) return json(400, { error: "missing_delivery_id" });
  if (!(await verifySignature(rawBody, signature))) {
    return json(401, { error: "invalid_signature" });
  }

  // Idempotency: replay returns the original result.
  const { data: existing } = await supabase
    .from("webhook_deliveries")
    .select("result_status, result_body")
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify(existing.result_body ?? {}), {
      status: existing.result_status,
      headers: { "Content-Type": "application/json", "X-Replay": "1" },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const ticketId = String(payload.ticket_id ?? "");
  const status = String(payload.status ?? "");
  const resolutionNote = payload.resolution_note ? String(payload.resolution_note) : null;
  const assignedToEmail = payload.assigned_to_email ? String(payload.assigned_to_email) : null;

  if (!ticketId) return json(400, { error: "missing_ticket_id" });
  if (!VALID_STATUSES.has(status)) return json(400, { error: "invalid_status", allowed: [...VALID_STATUSES] });
  if (status === "RESOLVED" && !resolutionNote) {
    return json(400, { error: "resolution_note_required_for_resolved" });
  }

  // Look up the current ticket so we can validate the transition.
  const { data: ticket, error: ticketErr } = await supabase
    .from("maintenance_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketErr) return json(500, { error: "ticket_lookup_failed", detail: ticketErr.message });
  if (!ticket) return json(404, { error: "ticket_not_found" });

  const allowed = ALLOWED_TRANSITIONS[ticket.status] ?? new Set<string>();
  if (!allowed.has(status)) {
    return json(409, {
      error: "invalid_transition",
      current_status: ticket.status,
      requested_status: status,
    });
  }

  // Resolve assigned_to_email → user id (optional).
  let assignedToId: string | null = null;
  if (assignedToEmail) {
    const { data: user } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", assignedToEmail)
      .maybeSingle();
    assignedToId = user?.id ?? null;
  }

  // Apply the update.
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (assignedToId) update.assigned_to = assignedToId;
  if (status === "RESOLVED") {
    update.resolution_note = resolutionNote;
    update.resolved_at = new Date().toISOString();
    if (assignedToId) update.resolved_by = assignedToId;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("maintenance_tickets")
    .update(update)
    .eq("id", ticketId)
    .select("id, status, assigned_to, resolution_note, resolved_at, updated_at")
    .single();
  if (updateErr) return json(500, { error: "update_failed", detail: updateErr.message });

  const result = { ok: true, ticket: updated };

  // Record the delivery so replays are no-ops.
  await supabase.from("webhook_deliveries").insert({
    delivery_id: deliveryId,
    source: SOURCE,
    ticket_id: ticketId,
    payload,
    result_status: 200,
    result_body: result,
  });

  return json(200, result);
});
