// verify-rent — matches real bank credits against rent rows, unattended.
//
// The rule this enforces is already stated in the codebase (AdminRentPage.jsx:240):
// nothing is settled unless real money is seen landing in the bank. Until the
// previous migration that was a comment; the database now refuses a PAID row
// without proof, and this function is what supplies the proof.
//
// It works because every rent row now carries a payment_ref (LB-CPPR3-2608)
// which the tenant quotes in their PayNow reference. Aspire gives us amount,
// date, counterparty and its own reference, none of which identify a tenant:
// amounts are neither unique across tenants nor stable, because they prorate.
// The ref is the only deterministic key, so matching is on the ref alone.
//
// It never marks anything PAID that it did not see money for, and it never
// closes a shortfall. A short payment becomes PARTIAL and stays visible.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ASPIRE_API = "https://api.aspireapp.com/public/v1";

/** Uppercase alphanumerics only, so "lb cppr3 2608" matches "LB-CPPR3-2608". */
function squash(s: unknown): string {
  return String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

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
      // Aspire returns amounts in cents.
      const amount = Number(t.amount ?? 0) / 100;
      const reference = String(t.reference ?? t.ref_code ?? t.transaction_reference ?? "");
      const counterparty = String(t.counterparty_name ?? t.description ?? "");
      return {
        id: String(t.id ?? `${t.datetime}-${amount}`),
        date: String(t.datetime ?? "").split("T")[0],
        amount,
        counterparty,
        reference,
        // The tenant's typed reference can land in any of these depending on
        // how the transfer was made, so search all of them rather than betting
        // on one field.
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
    unmatched: [] as Record<string, unknown>[],
    error: null as string | null,
  };

  try {
    const credits = await fetchCredits(from, to);
    summary.credits_seen = credits.length;

    // Every row still awaiting money. PAID rows are excluded so a second run
    // cannot re-apply a credit, and so a settled month is never reopened.
    const { data: open, error: openErr } = await supabase
      .from("rent_payments")
      .select("id, payment_ref, rent_amount, late_fee, paid_amount, status, payment_reference")
      .in("status", ["PENDING", "SUBMITTED", "OVERDUE", "PARTIAL"]);

    if (openErr) throw new Error(`rent_payments: ${openErr.message}`);

    const byRef = new Map<string, typeof open[number]>();
    for (const row of open ?? []) {
      if (row.payment_ref) byRef.set(squash(row.payment_ref), row);
    }

    // Credits already recorded against a row, so a re-run is a no-op.
    const { data: usedRows } = await supabase
      .from("rent_payments")
      .select("payment_reference")
      .not("payment_reference", "is", null);
    const used = new Set((usedRows ?? []).map((r) => String(r.payment_reference)));

    for (const c of credits) {
      if (used.has(c.id)) continue;

      const hit = [...byRef.entries()].find(([ref]) => ref && c.haystack.includes(ref));

      if (!hit) {
        summary.unmatched.push({
          aspire_id: c.id,
          date: c.date,
          amount: c.amount,
          counterparty: c.counterparty,
          reference: c.reference,
        });
        continue;
      }

      const [, row] = hit;
      const due = Number(row.rent_amount) + Number(row.late_fee ?? 0);
      const alreadyPaid = Number(row.paid_amount ?? 0);
      const nowPaid = Math.round((alreadyPaid + c.amount) * 100) / 100;
      // Bank transfers can land a cent or two off on conversion. Anything
      // inside a cent counts as settled; a real shortfall does not.
      const settled = nowPaid + 0.01 >= due;

      if (dryRun) {
        settled ? summary.matched++ : summary.partial++;
        continue;
      }

      const patch: Record<string, unknown> = {
        paid_amount: nowPaid,
        paid_at: `${c.date}T00:00:00+08:00`,
        payment_method: "PAYNOW",
        payment_reference: c.id,
        verification_source: "ASPIRE",
        verified_at: new Date().toISOString(),
        verified_by: "verify-rent",
        status: settled ? "PAID" : "PARTIAL",
      };

      const { error: upErr } = await supabase
        .from("rent_payments")
        .update(patch)
        .eq("id", row.id);

      if (upErr) {
        // One bad row must not abandon the rest of the batch, and a silent
        // failure here means money is seen but never recorded.
        console.error(`[verify-rent] ${row.payment_ref}: ${upErr.message}`);
        summary.unmatched.push({
          aspire_id: c.id,
          date: c.date,
          amount: c.amount,
          counterparty: c.counterparty,
          reference: c.reference,
          error: upErr.message,
        });
        continue;
      }

      used.add(c.id);
      byRef.delete(squash(row.payment_ref));
      settled ? summary.matched++ : summary.partial++;
    }
  } catch (err) {
    console.error("[verify-rent]", err);
    summary.error = (err as Error).message;
  }

  if (!dryRun) {
    // Logged whether the run succeeded or failed. A verification pass that
    // stopped running is exactly the failure nobody notices.
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
});
