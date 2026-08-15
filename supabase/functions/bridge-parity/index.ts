// Bridge parity canary: is what we deliver actually arriving where humans work?
//
// Born 15 Aug 2026: the backend at MILLIA_OUTBOUND_WEBHOOK_URL silently
// flipped its own database from millia-prod to millia-dev around 11 Aug, so
// every delivery kept returning 200 with a real task_id while landing in a
// database no member of staff looks at. Twelve days, zero alerts. This
// function compares our delivered outbound events (last 24h) against rows
// actually received in millia-prod's partner_inbound_log in the same window
// and stores the verdict in bridge_parity_status, which the mini watchdog
// reads on its hourly sweep.
//
// SCHEDULED: pg_cron "bridge-parity" hourly at minute 23.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const PROD_URL = Deno.env.get("MILLIA_PROD_URL") ?? "";
const PROD_KEY = Deno.env.get("MILLIA_PROD_SERVICE_KEY") ?? "";

Deno.serve(async () => {
  const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { count: delivered, error: qErr } = await supabase
    .from("partner_outbound_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "delivered")
    .gte("delivered_at", sinceIso);
  if (qErr) {
    return Response.json({ ok: false, error: qErr.message }, { status: 500 });
  }

  // Ask prod, not the webhook target: the whole point is to bypass the
  // backend's own idea of where it is writing.
  let prodReceived: number | null = null;
  let detail = "";
  try {
    const res = await fetch(
      `${PROD_URL}/rest/v1/partner_inbound_log?select=id&received_at=gte.${sinceIso}`,
      {
        headers: {
          apikey: PROD_KEY,
          Authorization: `Bearer ${PROD_KEY}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
    );
    if (res.ok || res.status === 206) {
      const range = res.headers.get("content-range") ?? "";
      prodReceived = Number(range.split("/")[1] ?? "0");
      if (Number.isNaN(prodReceived)) prodReceived = null;
    } else {
      detail = `prod probe HTTP ${res.status}`;
    }
    await res.body?.cancel();
  } catch (err) {
    detail = `prod probe failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  const ok = prodReceived === null
    ? false // cannot see prod: fail loud, never fail quiet
    : (delivered ?? 0) === 0 || prodReceived > 0;
  if (!detail) {
    detail = ok
      ? `${delivered ?? 0} delivered, ${prodReceived} received by prod`
      : `${delivered ?? 0} delivered but prod received ${prodReceived}: bridge is feeding the wrong database`;
  }

  const { error: upErr } = await supabase.from("bridge_parity_status").upsert({
    id: true,
    checked_at: new Date().toISOString(),
    delivered_24h: delivered ?? 0,
    prod_received_24h: prodReceived,
    ok,
    detail,
  });
  if (upErr) {
    return Response.json({ ok: false, error: upErr.message }, { status: 500 });
  }
  return Response.json({ ok, delivered_24h: delivered ?? 0, prod_received_24h: prodReceived, detail });
});
