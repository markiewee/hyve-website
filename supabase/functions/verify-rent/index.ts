// verify-rent — matches real bank credits against rent rows, unattended.
//
// The rule this enforces is already stated in the codebase (AdminRentPage.jsx:240):
// nothing is settled unless real money is seen landing in the bank. The
// database now refuses a PAID row without proof, and this function supplies it.
//
// Three tiers, because evidence differs in strength (see _shared/rentMatch.js):
//   AUTO      the tenant quoted their payment_ref, or their name and the exact
//             amount owed both agree with nothing else competing
//   REVIEW    weaker evidence: proposed to a human, never closed
//   UNMATCHED money arrived that resembles nothing we are owed
//
// It never marks anything PAID it did not see money for, never closes a
// shortfall, and never guesses on amount alone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchCredit, squash } from "../_shared/rentMatch.js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ASPIRE_API = "https://api.aspireapp.com/public/v1";

async function aspireToken(): Promise<string> {
  const clientId =
    Deno.env.get("ASPIRE_CLIENT_ID") ?? Deno.env.get("VITE_ASPIRE_CLIENT_ID");
  const apiKey = Deno.env.get("ASPIRE_API_KEY") ?? Deno.env.get("VITE_ASPIRE_API_KEY");
  if (!clientId || !apiKey) {
    throw new Error("Aspire not configured: set ASPIRE_CLIENT_ID and ASPIRE_API_KEY");
  }
  const r = await fetch(`${ASPIRE_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: apiKey,
    }),
  });
  if (!r.ok) throw new Error(`Aspire auth failed: ${await r.text()}`);
  return (await r.json()).access_token;
}

type Credit = {
  id: string;
  date: string;
  amount: number;
  counterparty: string;
  reference: string;
  haystack: string;
};

async function fetchCredits(from: string, to: string): Promise<Credit[]> {
  const token = await aspireToken();
  const qs = new URLSearchParams({
    start_date: `${from}T00:00:00Z`,
    end_date: `${to}T23:59:59Z`,
    per_page: "200",
  });
  const r = await fetch(`${ASPIRE_API}/transactions?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Aspire transactions failed: ${await r.text()}`);
  const body = await r.json();
  const raw: Record<string, unknown>[] = body.data ?? body.transactions ?? body ?? [];

  return (Array.isArray(raw) ? raw : [])
    .filter((t) => t.type === "credit")
    .map((t) => {
      const amount = Number(t.amount ?? 0) / 100; // Aspire returns cents
      return {
        id: String(t.id ?? `${t.datetime}-${amount}`),
        date: String(t.datetime ?? "").split("T")[0],
        amount,
        counterparty: String(t.counterparty_name ?? t.description ?? ""),
        reference: String(t.reference ?? t.ref_code ?? t.transaction_reference ?? ""),
        // A typed reference can land in any of these depending on how the
        // transfer was made, so search all of them rather than betting on one.
        haystack: squash(
          [t.reference, t.ref_code, t.counterparty_name, t.description, t.narrative, t.remarks]
            .filter(Boolean)
            .join(" ")
        ),
      };
    });
}

Deno.serve(async (req) => {
  const now = new Date();
  let body: { days_back?: number; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // cron posts '{}'
  }

  const daysBack = Number(body.days_back ?? 45);
  const dryRun = body.dry_run === true;
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - daysBack * 86400000).toISOString().slice(0, 10);

  const summary = {
    window_from: from,
    window_to: to,
    credits_seen: 0,
    matched: 0,
    partial: 0,
    proposed: 0,
    unmatched: [] as Record<string, unknown>[],
    decisions: [] as Record<string, unknown>[],
    error: null as string | null,
  };

  try {
    const credits = await fetchCredits(from, to);
    summary.credits_seen = credits.length;

    // Open rows only. PAID rows are excluded so a credit cannot be re-applied
    // and a settled month is never reopened.
    const { data: open, error: openErr } = await supabase
      .from("rent_payments")
      .select(
        "id, payment_ref, rent_amount, late_fee, paid_amount, status, tenant_profile_id, tenant_profiles(tenant_details(full_name))"
      )
      .in("status", ["PENDING", "SUBMITTED", "OVERDUE", "PARTIAL"]);

    if (openErr) throw new Error(`rent_payments: ${openErr.message}`);

    // Flatten the tenant name onto the row so the matcher stays pure.
    const rows = (open ?? []).map((r) => {
      const tp = Array.isArray(r.tenant_profiles) ? r.tenant_profiles[0] : r.tenant_profiles;
      const td = Array.isArray(tp?.tenant_details) ? tp?.tenant_details[0] : tp?.tenant_details;
      return { ...r, tenant_name: td?.full_name ?? null };
    });

    // Credits already applied to a row, and credits already proposed. Both are
    // needed: the cron runs every 30 minutes over a 45-day window, so without
    // this the queue would refill with the same credits 48 times a day.
    const [{ data: usedRows }, { data: proposedRows }] = await Promise.all([
      supabase.from("rent_payments").select("payment_reference").not("payment_reference", "is", null),
      supabase.from("rent_match_proposals").select("aspire_id"),
    ]);
    const used = new Set((usedRows ?? []).map((r) => String(r.payment_reference)));
    const proposed = new Set((proposedRows ?? []).map((r) => String(r.aspire_id)));

    const available = new Map(rows.map((r) => [r.id, r]));

    for (const c of credits) {
      if (used.has(c.id) || proposed.has(c.id)) continue;

      const verdict = matchCredit(c, [...available.values()]);

      if (verdict.decision === "AUTO") {
        const row = verdict.row!;
        const due = Number(row.rent_amount) + Number(row.late_fee ?? 0);
        const nowPaid = Math.round((Number(row.paid_amount ?? 0) + c.amount) * 100) / 100;
        const settled = nowPaid + 0.01 >= due;

        if (dryRun) {
          settled ? summary.matched++ : summary.partial++;
          summary.decisions.push({ aspire_id: c.id, decision: "AUTO", ref: row.payment_ref, reason: verdict.reason });
          continue;
        }

        const { error: upErr } = await supabase
          .from("rent_payments")
          .update({
            paid_amount: nowPaid,
            paid_at: `${c.date}T00:00:00+08:00`,
            payment_method: "PAYNOW",
            payment_reference: c.id,
            verification_source: "ASPIRE",
            verified_at: new Date().toISOString(),
            verified_by: "verify-rent",
            status: settled ? "PAID" : "PARTIAL",
          })
          .eq("id", row.id);

        if (upErr) {
          // A failure here means money was seen and never recorded, which is
          // the worst outcome. Demote it to the review queue rather than drop it.
          console.error(`[verify-rent] ${row.payment_ref}: ${upErr.message}`);
          await proposeIfLive(c, { ...verdict, reason: `write failed: ${upErr.message}` }, dryRun);
          summary.proposed++;
          continue;
        }

        used.add(c.id);
        if (settled) available.delete(row.id);
        settled ? summary.matched++ : summary.partial++;
        summary.decisions.push({ aspire_id: c.id, decision: "AUTO", ref: row.payment_ref, reason: verdict.reason });
        continue;
      }

      if (verdict.decision === "REVIEW") {
        await proposeIfLive(c, verdict, dryRun);
        summary.proposed++;
        summary.decisions.push({
          aspire_id: c.id,
          decision: "REVIEW",
          confidence: verdict.confidence,
          reason: verdict.reason,
        });
        continue;
      }

      summary.unmatched.push({
        aspire_id: c.id,
        date: c.date,
        amount: c.amount,
        counterparty: c.counterparty,
        reference: c.reference,
      });
      // Still recorded, because unattributed money is a question for a human
      // rather than something to forget.
      await proposeIfLive(c, verdict, dryRun);
    }
  } catch (err) {
    console.error("[verify-rent]", err);
    summary.error = (err as Error).message;
  }

  if (!dryRun) {
    // Logged whether the run succeeded or failed. A verification pass that
    // quietly stopped running is exactly the failure nobody notices.
    await supabase.from("rent_verification_runs").insert({
      window_from: summary.window_from,
      window_to: summary.window_to,
      credits_seen: summary.credits_seen,
      matched: summary.matched,
      partial: summary.partial,
      unmatched: summary.unmatched,
      error: summary.error,
    });
  }

  return new Response(JSON.stringify(summary), {
    status: summary.error ? 500 : 200,
    headers: { "Content-Type": "application/json" },
  });

  async function proposeIfLive(
    c: Credit,
    verdict: { row: { id: string } | null; confidence: number; reason: string; alternatives: unknown[] },
    dry: boolean
  ) {
    if (dry) return;
    const { error } = await supabase.from("rent_match_proposals").insert({
      aspire_id: c.id,
      credit_date: c.date,
      credit_amount: c.amount,
      counterparty: c.counterparty,
      credit_reference: c.reference,
      proposed_rent_payment_id: verdict.row?.id ?? null,
      confidence: verdict.confidence,
      reason: verdict.reason,
      alternatives: verdict.alternatives ?? [],
    });
    // A duplicate is the unique index doing its job on a re-run, not an error.
    if (error && !String(error.message).includes("duplicate key")) {
      console.error("[verify-rent] proposal insert failed:", error.message);
    }
  }
});
