import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  const d = new Date(dateStr);
  return d.toLocaleString("en-SG", { month: "long", year: "numeric" });
}

Deno.serve(async (_req) => {
  try {
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    const results: string[] = [];

    const { data: overdue } = await supabase
      .from("invoices")
      .select(
        "id, invoice_code, tenant_profile_id, total_due, total_paid, due_date, month, last_reminder_days_overdue, invoice_line_items(category)"
      )
      .in("status", ["ISSUED", "PARTIALLY_PAID"])
      .lt("due_date", today);

    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ results: ["No overdue invoices"] }), {
        status: 200,
      });
    }

    for (const inv of overdue) {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Cap automated reminders at 30 days
      if (daysOverdue > 30) {
        results.push(`${inv.invoice_code}: ${daysOverdue} days overdue — capped, manual handling required`);
        continue;
      }

      const lastDays = Number(inv.last_reminder_days_overdue ?? 0);
      const existingLateFees = (inv.invoice_line_items ?? []).filter(
        (li: { category: string }) => li.category === "LATE_FEE"
      ).length;
      const outstanding = Number(inv.total_due) - Number(inv.total_paid);
      const month_label = inv.month ? monthLabel(inv.month) : "this month";

      const baseDetails = {
        invoice_id: inv.id,
        invoice_code: inv.invoice_code,
        amount: outstanding.toFixed(2),
        days_overdue: daysOverdue,
        month_label,
      };

      let actionTaken = false;

      // ─── Day 30 (29+ overdue): FINAL NOTICE + second 5% late fee ───
      if (daysOverdue >= 29 && lastDays < 29) {
        let secondFee = 0;
        if (existingLateFees < 2) {
          secondFee = Math.round(outstanding * 0.05 * 100) / 100;
          await supabase.from("invoice_line_items").insert({
            invoice_id: inv.id,
            category: "LATE_FEE",
            description: `Late fee (30+ days overdue) — 5% of $${outstanding.toFixed(2)}`,
            amount: secondFee,
            billing_type: "POST",
          });
          const newTotal = Number(inv.total_due) + secondFee;
          await supabase
            .from("invoices")
            .update({
              subtotal: newTotal,
              total_due: newTotal,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id);
        }
        await notify(inv.tenant_profile_id, "INVOICE_FINAL_NOTICE", {
          ...baseDetails,
          late_fee: secondFee.toFixed(2),
        });
        results.push(`${inv.invoice_code}: FINAL NOTICE sent (${daysOverdue} days overdue, second fee $${secondFee})`);
        actionTaken = true;
      }
      // ─── Day 6+ (5+ overdue), every 2 days from day 7 overdue: REMINDER ───
      else if (daysOverdue >= 7 && (daysOverdue - 7) % 2 === 0 && lastDays < daysOverdue) {
        await notify(inv.tenant_profile_id, "INVOICE_OVERDUE_REMINDER", baseDetails);
        results.push(`${inv.invoice_code}: reminder sent (${daysOverdue} days overdue)`);
        actionTaken = true;
      }
      // ─── Day 6 (5 overdue): apply first 5% late fee + send "fee applied" ───
      else if (daysOverdue >= 5 && existingLateFees < 1) {
        const firstFee = Math.round(outstanding * 0.05 * 100) / 100;
        await supabase.from("invoice_line_items").insert({
          invoice_id: inv.id,
          category: "LATE_FEE",
          description: `Late fee (5+ days overdue) — 5% of $${outstanding.toFixed(2)}`,
          amount: firstFee,
          billing_type: "POST",
        });
        const newTotal = Number(inv.total_due) + firstFee;
        await supabase
          .from("invoices")
          .update({
            subtotal: newTotal,
            total_due: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        await notify(inv.tenant_profile_id, "INVOICE_OVERDUE", {
          ...baseDetails,
          late_fee: firstFee.toFixed(2),
        });
        results.push(`${inv.invoice_code}: late fee $${firstFee} applied + email sent (${daysOverdue} days overdue)`);
        actionTaken = true;
      }
      // ─── Day 5 (4 overdue): warn that fee will be applied tomorrow ───
      else if (daysOverdue === 4 && lastDays < 4) {
        const estimatedFee = Math.round(outstanding * 0.05 * 100) / 100;
        await notify(inv.tenant_profile_id, "INVOICE_LATE_FEE_WARNING", {
          ...baseDetails,
          estimated_late_fee: estimatedFee.toFixed(2),
        });
        results.push(`${inv.invoice_code}: late fee warning sent (${daysOverdue} days overdue)`);
        actionTaken = true;
      }
      // ─── Day 4 (3 overdue): friendly "you're late" notice ───
      else if (daysOverdue === 3 && lastDays < 3) {
        await notify(inv.tenant_profile_id, "INVOICE_LATE_NOTICE", baseDetails);
        results.push(`${inv.invoice_code}: friendly late notice sent (${daysOverdue} days overdue)`);
        actionTaken = true;
      }

      if (actionTaken) {
        await supabase
          .from("invoices")
          .update({
            last_reminder_at: now.toISOString(),
            last_reminder_days_overdue: daysOverdue,
          })
          .eq("id", inv.id);
      }
    }

    return new Response(JSON.stringify({ results }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
    });
  }
});
