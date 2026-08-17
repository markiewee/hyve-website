// check-late-fees — the arrears ladder, repointed onto rent_payments.
//
// What this replaces. The previous version read `invoices`, which has had one
// row in its entire life, while the business writes `rent_payments`, which has
// 104. So this cron ran faithfully every night since May and stacked late fees
// onto a single orphan invoice, while every real arrear went unchased.
//
// Starting position, decided by Mark on 9 August 2026: the ladder starts clean
// from August. It does not backfill. There are 17 outstanding rows worth about
// S$15,846 going back to February, several already settled or waived privately
// off-system, and 16 of them are past the 30-day cap anyway. Chasing those
// automatically would send wrong numbers to real tenants.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { selectRung, round2, CAP_DAYS } from "../_shared/arrearsLadder.js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Nothing before this month is ever chased automatically. See the note above. */
const LADDER_STARTS = "2026-08-01";

// The rungs, the 5% rate and the 30-day cap now live in _shared/arrearsLadder.js
// so they can be unit tested without a database. CAP_DAYS is re-exported from
// there and used below only for the log line.

async function notify(
  tenant_profile_id: string,
  event_type: string,
  details: Record<string, unknown>
) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-tenant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ event_type, tenant_profile_id, details }),
    });
  } catch (e) {
    console.error(`notify-tenant failed (${event_type}):`, e);
  }
}

function monthLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-SG", { month: "long", year: "numeric" });
}


Deno.serve(async (req) => {
  try {
    const dryRun = new URL(req.url).searchParams.get("dry") === "1";
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
    const results: string[] = [];

    const { data: overdue, error } = await supabase
      .from("rent_payments")
      .select(
        "id, tenant_profile_id, month, rent_amount, late_fee, late_fee_count, paid_amount, due_date, status, last_reminder_days_overdue, payment_ref, tenant_profiles(late_fee_waived)"
      )
      .in("status", ["PENDING", "SUBMITTED", "OVERDUE", "PARTIAL"])
      .gte("month", LADDER_STARTS)
      .lt("due_date", today);

    if (error) throw new Error(`rent_payments: ${error.message}`);

    if (!overdue || overdue.length === 0) {
      return json({ results: ["No overdue rent"] });
    }

    for (const rp of overdue) {
      const tp = Array.isArray(rp.tenant_profiles) ? rp.tenant_profiles[0] : rp.tenant_profiles;
      if (tp?.late_fee_waived) {
        results.push(`${rp.payment_ref}: waived, skipped`);
        continue;
      }

      const daysOverdue = Math.floor(
        (new Date(`${today}T00:00:00+08:00`).getTime() -
          new Date(`${rp.due_date}T00:00:00+08:00`).getTime()) /
          86400000
      );

      if (daysOverdue > CAP_DAYS) {
        results.push(`${rp.payment_ref}: ${daysOverdue} days, past the cap, manual handling`);
        continue;
      }

      const currentFee = Number(rp.late_fee ?? 0);
      const outstanding = round2(
        Number(rp.rent_amount) + currentFee - Number(rp.paid_amount ?? 0)
      );

      // Which rung fires today, if any. Pure decision, tested in
      // _shared/arrearsLadder.test.js. Each rung names its own template, which
      // is the point of this change: every rung used to send RENT_OVERDUE, so
      // a tenant three days late read the same words as one twenty-nine days
      // late while the fees quietly escalated underneath.
      const rung = selectRung({
        daysOverdue,
        lastRemindedAtDays: Number(rp.last_reminder_days_overdue ?? 0),
        feeCount: Number(rp.late_fee_count ?? 0),
        outstanding,
        currentFee,
      });

      if (!rung.event) {
        results.push(`${rp.payment_ref}: ${rung.reason}`);
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (rung.newFee > 0) {
        patch.late_fee = round2(currentFee + rung.newFee);
        patch.late_fee_count = rung.newFeeCount;
        patch.late_fee_applied_at = now.toISOString();
      }

      // The amount quoted must include the fee applied in this same pass, or
      // the tenant is told to pay less than the row now says they owe.
      const owedNow = round2(outstanding + rung.newFee);

      // Dry run prints the decision and touches nothing: no email, no fee, no
      // row update. Used to eyeball a change against real arrears before it
      // can reach a tenant.
      if (dryRun) {
        results.push(
          `${rp.payment_ref}: WOULD SEND ${rung.event} (${daysOverdue} days, ` +
            `SGD ${owedNow.toFixed(2)}, fee +${rung.newFee.toFixed(2)})`
        );
        continue;
      }

      await notify(rp.tenant_profile_id, rung.event, {
        invoice_code: rp.payment_ref,
        invoice_id: rp.id,
        month_label: monthLabel(rp.month),
        amount: owedNow.toFixed(2),
        days_overdue: daysOverdue,
        late_fee: round2(currentFee + rung.newFee).toFixed(2),
        estimated_late_fee: rung.estimatedLateFee.toFixed(2),
        payment_ref: rp.payment_ref,
      });
      results.push(`${rp.payment_ref}: ${rung.event} (${daysOverdue} days)`);

      patch.last_reminder_at = now.toISOString();
      patch.last_reminder_days_overdue = daysOverdue;
      patch.is_late = true;
      // Deliberately NOT touching status: OVERDUE is a display state, and
      // moving a SUBMITTED row backwards would hide a tenant's proof.
      if (rp.status === "PENDING") patch.status = "OVERDUE";

      const { error: upErr } = await supabase
        .from("rent_payments")
        .update(patch)
        .eq("id", rp.id);
      if (upErr) {
        console.error(`[check-late-fees] ${rp.payment_ref}: ${upErr.message}`);
        results.push(`${rp.payment_ref}: UPDATE FAILED, ${upErr.message}`);
      }
    }

    return json({ results });
  } catch (err) {
    console.error("[check-late-fees]", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
