import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (_req) => {
  try {
    const now = new Date();
    const results: string[] = [];

    // Fetch unpaid invoices past due date
    const { data: overdue } = await supabase
      .from("invoices")
      .select("id, invoice_code, total_due, total_paid, due_date, invoice_line_items(category)")
      .in("status", ["ISSUED", "PARTIALLY_PAID"])
      .lt("due_date", now.toISOString().substring(0, 10));

    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ results: ["No overdue invoices"] }), { status: 200 });
    }

    for (const inv of overdue) {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const existingLateFees = (inv.invoice_line_items ?? []).filter(
        (li: { category: string }) => li.category === "LATE_FEE"
      ).length;

      const outstanding = Number(inv.total_due) - Number(inv.total_paid);
      let feeToAdd = 0;
      let feeDescription = "";

      if (daysOverdue > 30 && existingLateFees < 2) {
        // Add second 5% late fee
        feeToAdd = Math.round(outstanding * 0.05 * 100) / 100;
        feeDescription = `Late fee (30+ days overdue) — 5% of $${outstanding.toFixed(2)}`;
      } else if (daysOverdue > 5 && existingLateFees < 1) {
        // Add first 5% late fee
        feeToAdd = Math.round(outstanding * 0.05 * 100) / 100;
        feeDescription = `Late fee (5+ days overdue) — 5% of $${outstanding.toFixed(2)}`;
      }

      if (feeToAdd > 0) {
        await supabase.from("invoice_line_items").insert({
          invoice_id: inv.id,
          category: "LATE_FEE",
          description: feeDescription,
          amount: feeToAdd,
          billing_type: "POST",
        });

        const newTotal = Number(inv.total_due) + feeToAdd;
        await supabase
          .from("invoices")
          .update({
            subtotal: newTotal,
            total_due: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        results.push(`${inv.invoice_code}: added $${feeToAdd} late fee (${daysOverdue} days overdue)`);
      }
    }

    return new Response(JSON.stringify({ results }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
