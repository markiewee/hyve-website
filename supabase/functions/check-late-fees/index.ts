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

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Nothing before this month is ever chased automatically. See the note above. */
const LADDER_STARTS = "2026-08-01";

/** Automated chasing stops here; past this it is a conversation, not an email. */
const CAP_DAYS = 30;

const LATE_FEE_RATE = 0.05;

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

Deno.serve(async (_req) => {
  try {
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

      const lastDays = Number(rp.last_reminder_days_overdue ?? 0);
      const feeCount = Number(rp.late_fee_count ?? 0);
      const currentFee = Number(rp.late_fee ?? 0);
      const outstanding = round2(
        Number(rp.rent_amount) + currentFee - Number(rp.paid_amount ?? 0)
      );

      if (outstanding <= 0) {
        results.push(`${rp.payment_ref}: nothing outstanding, skipped`);
        continue;
      }

      const base = {
        month: monthLabel(rp.month),
        amount: outstanding.toFixed(2),
        days_overdue: daysOverdue,
        payment_ref: rp.payment_ref,
      };

      let acted = false;
      const patch: Record<string, unknown> = {};

      // ── 29+ days: final notice, second 5% ──────────────────────────────
      if (daysOverdue >= 29 && lastDays < 29) {
        let secondFee = 0;
        if (feeCount < 2) {
          secondFee = round2(outstanding * LATE_FEE_RATE);
          patch.late_fee = round2(currentFee + secondFee);
          patch.late_fee_count = feeCount + 1;
          patch.late_fee_applied_at = now.toISOString();
        }
        await notify(rp.tenant_profile_id, "RENT_OVERDUE", {
          ...base,
          late_fee: secondFee.toFixed(2),
          final_notice: true,
        });
        results.push(`${rp.payment_ref}: FINAL NOTICE, second fee $${secondFee}`);
        acted = true;
      }
      // ── 7+ days, every other day: reminder ─────────────────────────────
      else if (daysOverdue >= 7 && (daysOverdue - 7) % 2 === 0 && lastDays < daysOverdue) {
        await notify(rp.tenant_profile_id, "RENT_OVERDUE", {
          ...base,
          late_fee: currentFee.toFixed(2),
        });
        results.push(`${rp.payment_ref}: reminder (${daysOverdue} days)`);
        acted = true;
      }
      // ── 5+ days: first 5% fee ──────────────────────────────────────────
      else if (daysOverdue >= 5 && feeCount < 1) {
        const firstFee = round2(outstanding * LATE_FEE_RATE);
        patch.late_fee = round2(currentFee + firstFee);
        patch.late_fee_count = 1;
        patch.late_fee_applied_at = now.toISOString();
        await notify(rp.tenant_profile_id, "RENT_OVERDUE", {
          ...base,
          late_fee: firstFee.toFixed(2),
        });
        results.push(`${rp.payment_ref}: late fee $${firstFee} applied (${daysOverdue} days)`);
        acted = true;
      }
      // ── 4 days: the fee lands tomorrow ─────────────────────────────────
      else if (daysOverdue === 4 && lastDays < 4) {
        await notify(rp.tenant_profile_id, "RENT_OVERDUE", {
          ...base,
          late_fee: round2(outstanding * LATE_FEE_RATE).toFixed(2),
          warning_only: true,
        });
        results.push(`${rp.payment_ref}: late fee warning (${daysOverdue} days)`);
        acted = true;
      }
      // ── 3 days: friendly nudge, no fee ─────────────────────────────────
      else if (daysOverdue === 3 && lastDays < 3) {
        await notify(rp.tenant_profile_id, "RENT_OVERDUE", { ...base, late_fee: null });
        results.push(`${rp.payment_ref}: friendly notice (${daysOverdue} days)`);
        acted = true;
      }

      if (acted) {
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
