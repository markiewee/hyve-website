// generate-rent — creates the month's rent rows, unattended.
//
// Why this exists: rent creation was a button in a React admin page with no
// schedule behind it. On 9 August 2026, nine days into the month, exactly one
// of 21 active tenants had been billed. The other twenty were carrying no
// invoice at all. A button nobody presses is not a billing system.
//
// Idempotent by design. It skips any tenant who already has a row for the
// month, so running it twice, or running it by hand after the cron, cannot
// double-bill. payment_ref is minted by the database trigger, not here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rentForMonth, monthStart } from "../_shared/rentMath.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Tell the tenant what they owe and, crucially, the reference to quote.
 * Verification matches on payment_ref alone, so a bill the tenant never sees
 * the ref for is a payment that will arrive unattributed.
 */
async function notifyRentDue(
  tenant_profile_id: string,
  details: Record<string, unknown>
) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-tenant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ event_type: "RENT_DUE", tenant_profile_id, details }),
    });
  } catch (e) {
    // A failed email must not undo a correct bill. The row exists either way.
    console.error("[generate-rent] RENT_DUE notify failed:", e);
  }
}

/** Today in Singapore, as YYYY-MM-DD. The cron fires in UTC. */
function todaySGT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

Deno.serve(async (req) => {
  try {
    let body: { month?: string; dry_run?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // A cron posts '{}' or nothing at all. Both are fine.
    }

    const month = monthStart(body.month || todaySGT());
    const dryRun = body.dry_run === true;

    const { data: profiles, error: profErr } = await supabase
      .from("tenant_profiles")
      .select(
        "id, monthly_rent, room_id, is_active, onboarding_progress(tenancy_start_date, tenancy_end_date)"
      )
      .eq("is_active", true)
      .not("monthly_rent", "is", null)
      .gt("monthly_rent", 0);

    if (profErr) throw new Error(`tenant_profiles: ${profErr.message}`);

    const { data: existing, error: exErr } = await supabase
      .from("rent_payments")
      .select("tenant_profile_id")
      .eq("month", month);

    if (exErr) throw new Error(`rent_payments: ${exErr.message}`);

    const alreadyBilled = new Set((existing ?? []).map((r) => r.tenant_profile_id));

    const rows: Record<string, unknown>[] = [];
    const skipped: { tenant_profile_id: string; reason: string }[] = [];

    for (const p of profiles ?? []) {
      if (alreadyBilled.has(p.id)) {
        skipped.push({ tenant_profile_id: p.id, reason: "already billed this month" });
        continue;
      }
      if (!p.room_id) {
        // room_id is NOT NULL on rent_payments, so this would throw mid-batch
        // and take the whole run down with it. Report it instead.
        skipped.push({ tenant_profile_id: p.id, reason: "no room assigned" });
        continue;
      }

      // onboarding_progress is a to-one relation but PostgREST may hand back an
      // array depending on how the FK is declared. Accept both.
      const op = Array.isArray(p.onboarding_progress)
        ? p.onboarding_progress[0]
        : p.onboarding_progress;

      const billing = rentForMonth({
        month,
        monthlyRent: p.monthly_rent,
        start: op?.tenancy_start_date ?? null,
        end: op?.tenancy_end_date ?? null,
      });

      if (!billing) {
        skipped.push({
          tenant_profile_id: p.id,
          reason: "tenancy does not cover this month",
        });
        continue;
      }

      rows.push({
        tenant_profile_id: p.id,
        room_id: p.room_id,
        month,
        rent_amount: billing.amount,
        late_fee: 0,
        due_date: month,
        status: "PENDING",
        is_late: false,
        notes: billing.prorated
          ? `Prorated: ${billing.days} of ${billing.ofDays} days occupied.`
          : null,
      });
    }

    if (dryRun) {
      return json({ month, dry_run: true, would_insert: rows.length, rows, skipped });
    }

    if (rows.length === 0) {
      return json({ month, inserted: 0, skipped, message: "Nothing to bill." });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("rent_payments")
      .insert(rows)
      .select("id, payment_ref, rent_amount, tenant_profile_id, notes");

    if (insErr) throw new Error(`insert: ${insErr.message}`);

    const monthName = new Date(`${month}T00:00:00Z`).toLocaleString("en-SG", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    for (const r of inserted ?? []) {
      await notifyRentDue(r.tenant_profile_id, {
        month: monthName,
        amount: Number(r.rent_amount).toFixed(2),
        due_date: month,
        payment_ref: r.payment_ref,
        prorated_note: r.notes ?? null,
      });
    }

    const total = (inserted ?? []).reduce((n, r) => n + Number(r.rent_amount), 0);

    return json({
      month,
      inserted: inserted?.length ?? 0,
      total_billed: Math.round(total * 100) / 100,
      refs: (inserted ?? []).map((r) => r.payment_ref),
      skipped,
    });
  } catch (err) {
    console.error("[generate-rent]", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
