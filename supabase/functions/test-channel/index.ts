// test-channel — does this platform actually answer?
//
// Honest about what it proves. Today it can only establish REACHABILITY: the
// platform's site responds and we are not blocked outright. It cannot prove a
// session is alive, and it certainly cannot prove a listing landed correctly,
// because no mapper or read-back exists yet. The kind of test performed is
// recorded alongside the result so a green tick can never imply more than was
// actually checked.
//
// This runs server-side because the browser cannot fetch another origin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  let body: { channel_id?: string } = {};
  try {
    body = await req.json();
  } catch { /* handled below */ }

  if (!body.channel_id) return json({ error: "channel_id required" }, 400);

  const { data: channel, error } = await supabase
    .from("listing_channels")
    .select("id, slug, name, config")
    .eq("id", body.channel_id)
    .single();

  if (error || !channel) return json({ error: error?.message ?? "channel not found" }, 404);

  const url = channel.config?.test_url ?? `https://${channel.slug}.com`;
  const started = Date.now();

  let status: "PASS" | "FAIL" = "FAIL";
  const result: Record<string, unknown> = { url };

  try {
    // A HEAD is enough to know the host resolves and answers, and it does not
    // pull a whole page down on every click.
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    result.http_status = res.status;
    result.ms = Date.now() - started;
    // 4xx still means the host answered us. Only a dead host or an outright
    // block is a failure at this stage.
    status = res.status < 500 ? "PASS" : "FAIL";
    if (res.status === 403) {
      status = "FAIL";
      result.note = "403, likely bot protection. This one will need a real browser session.";
    }
  } catch (e) {
    result.error = (e as Error).message;
    result.ms = Date.now() - started;
  }

  await supabase
    .from("listing_channels")
    .update({
      last_tested_at: new Date().toISOString(),
      test_status: status,
      test_kind: "REACHABILITY",
      test_result: result,
    })
    .eq("id", channel.id);

  return json({ channel: channel.slug, status, kind: "REACHABILITY", result });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
}
