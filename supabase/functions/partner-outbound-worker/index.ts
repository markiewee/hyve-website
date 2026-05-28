// Outbound queue worker: Lazybee → Millia.
//
// SCHEDULED: */1 * * * *   (recommended cron — Mark wires this via Supabase
//                           scheduled functions or pg_cron.)
//
// Endpoint:    POST /functions/v1/partner-outbound-worker
// Behaviour:   Pops up to BATCH_SIZE pending rows from partner_outbound_queue
//              where next_attempt_at <= now() AND status = 'pending'.
//              Signs each envelope with HMAC-SHA256 over "{ts}.{body}", POSTs
//              to MILLIA_OUTBOUND_WEBHOOK_URL, and records the result.
// Backoff:     1m, 2m, 5m, 15m, 30m, 1h, 2h, 4h, 8h cap. After 24h elapsed
//              since created_at → dead_lettered + console.error (RIA signal
//              lives on Jason's side, not ours).
//
// Spec: docs/integrations/millia-handshake-v1.md (v1).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SECRET =
  Deno.env.get("MILLIA_PARTNER_SECRET") ??
  Deno.env.get("LAZYBEE_WEBHOOK_SECRET") ??
  "";
const TARGET_URL = Deno.env.get("MILLIA_OUTBOUND_WEBHOOK_URL") ?? "";

const BATCH_SIZE = 20;
const DEAD_LETTER_AFTER_MS = 24 * 60 * 60 * 1000; // 24h
const REQUEST_TIMEOUT_MS = 10_000;

// Backoff schedule in seconds, indexed by attempt count (post-failure).
// attempt=1 → wait 60s before next try, attempt=2 → 120s, ... attempt>=9 → 8h cap.
const BACKOFF_SECONDS = [60, 120, 300, 900, 1800, 3600, 7200, 14400, 28800];

function backoffSeconds(attempt: number): number {
  if (attempt <= 0) return BACKOFF_SECONDS[0];
  if (attempt >= BACKOFF_SECONDS.length) {
    return BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1];
  }
  return BACKOFF_SECONDS[attempt - 1];
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

interface QueueRow {
  delivery_id: string;
  ticket_id: string;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
  created_at: string;
}

async function deliverOne(row: QueueRow): Promise<void> {
  const rawBody = JSON.stringify(row.payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${await hmacHex(SECRET, `${ts}.${rawBody}`)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let statusCode = 0;
  let responseText = "";
  let networkError: string | null = null;

  try {
    const res = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Millia-Signature": signature,
        "X-Millia-Timestamp": ts,
        "X-Millia-Delivery-Id": row.delivery_id,
      },
      body: rawBody,
      signal: controller.signal,
    });
    statusCode = res.status;
    responseText = (await res.text()).slice(0, 2000);
  } catch (err) {
    networkError = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }

  const ok = statusCode >= 200 && statusCode < 300;

  if (ok) {
    await supabase
      .from("partner_outbound_queue")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        last_status_code: statusCode,
        last_response: responseText,
        attempt: row.attempt + 1,
      })
      .eq("delivery_id", row.delivery_id);

    // Stamp audit trail on the ticket (won't re-emit — trigger filters on
    // last_sync_source='local', and outbound_to_partner ≠ local).
    await supabase
      .from("maintenance_tickets")
      .update({ last_sync_source: "outbound_to_partner" })
      .eq("id", row.ticket_id)
      .eq("last_sync_source", "local");
    return;
  }

  // Failure path: dead-letter if over 24h, else schedule next attempt.
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  const nextAttempt = row.attempt + 1;

  if (ageMs >= DEAD_LETTER_AFTER_MS) {
    await supabase
      .from("partner_outbound_queue")
      .update({
        status: "dead_lettered",
        attempt: nextAttempt,
        last_status_code: statusCode,
        last_response: networkError ?? responseText,
      })
      .eq("delivery_id", row.delivery_id);

    console.error("[partner-outbound-worker] dead_lettered", {
      delivery_id: row.delivery_id,
      ticket_id: row.ticket_id,
      event: row.event,
      attempts: nextAttempt,
      last_status_code: statusCode,
      last_response: networkError ?? responseText,
    });
    return;
  }

  const backoff = backoffSeconds(nextAttempt);
  const nextAt = new Date(Date.now() + backoff * 1000).toISOString();

  await supabase
    .from("partner_outbound_queue")
    .update({
      status: "pending",
      attempt: nextAttempt,
      next_attempt_at: nextAt,
      last_status_code: statusCode,
      last_response: networkError ?? responseText,
    })
    .eq("delivery_id", row.delivery_id);
}

Deno.serve(async (_req) => {
  if (!SECRET || !TARGET_URL) {
    return new Response(
      JSON.stringify({
        error: "missing_env",
        detail: "MILLIA_PARTNER_SECRET and MILLIA_OUTBOUND_WEBHOOK_URL required",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Atomically claim a batch: flip 'pending' → 'in_flight' for due rows.
  // (Supabase JS doesn't expose SKIP LOCKED — best-effort UPDATE...RETURNING
  // via a regular update is safe at our scale because the worker is the only
  // writer and the cron is */1.)
  const { data: claimed, error: claimErr } = await supabase
    .from("partner_outbound_queue")
    .update({ status: "in_flight" })
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .select("delivery_id, ticket_id, event, payload, attempt, created_at")
    .limit(BATCH_SIZE);

  if (claimErr) {
    console.error("[partner-outbound-worker] claim failed", claimErr);
    return new Response(
      JSON.stringify({ error: "claim_failed", detail: claimErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const rows = (claimed ?? []) as QueueRow[];
  let delivered = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await deliverOne(row);
        delivered++;
      } catch (err) {
        failed++;
        console.error("[partner-outbound-worker] delivery threw", {
          delivery_id: row.delivery_id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Reset to pending so it gets retried next tick.
        await supabase
          .from("partner_outbound_queue")
          .update({ status: "pending" })
          .eq("delivery_id", row.delivery_id);
      }
    }),
  );

  return new Response(
    JSON.stringify({
      claimed: rows.length,
      delivered,
      failed,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
