import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function generateInvoiceCode(
  propertyCode: string,
  roomUnitCode: string,
  month: string,
  type: string,
  seq = 1
): string {
  const roomSuffix = roomUnitCode.includes("-")
    ? roomUnitCode.split("-").slice(1).join("-")
    : roomUnitCode;
  const yyyymm = month.substring(0, 7).replace("-", "");
  let suffix: string;
  if (type === "MOVE_IN") suffix = "MI";
  else if (type === "MOVE_OUT") suffix = "MO";
  else suffix = String(seq).padStart(3, "0");
  return `HV-${propertyCode}-${roomSuffix}-${yyyymm}-${suffix}`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const phase = body.phase ?? "pre"; // "pre" or "post"

    const now = new Date();
    let targetMonth: string;

    if (phase === "pre") {
      // Pre-consumption: generate for NEXT month, run on last day of current month
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      targetMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    } else {
      // Post-consumption: update CURRENT month invoices, run on 5th
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }

    const results: string[] = [];

    if (phase === "pre") {
      // Fetch active tenants with rent
      const { data: tenants } = await supabase
        .from("tenant_profiles")
        .select("id, monthly_rent, room_id, rooms(unit_code, property_id, properties(name, code))")
        .eq("is_active", true)
        .not("monthly_rent", "is", null)
        .gt("monthly_rent", 0);

      if (!tenants || tenants.length === 0) {
        return new Response(JSON.stringify({ phase, results: ["No active tenants found"] }), { status: 200 });
      }

      for (const tenant of tenants) {
        const room = tenant.rooms;
        if (!room) continue;
        const property = room.properties;
        if (!property) continue;

        // Check if invoice already exists
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_profile_id", tenant.id)
          .eq("month", targetMonth)
          .eq("type", "MONTHLY")
          .limit(1);

        if (existing && existing.length > 0) {
          results.push(`${room.unit_code}: skipped (exists)`);
          continue;
        }

        const invoiceCode = generateInvoiceCode(property.code, room.unit_code, targetMonth, "MONTHLY");

        // Create invoice
        const { data: invoice, error: invError } = await supabase
          .from("invoices")
          .insert({
            invoice_code: invoiceCode,
            tenant_profile_id: tenant.id,
            room_id: tenant.room_id,
            property_id: room.property_id,
            month: targetMonth,
            type: "MONTHLY",
            status: "ISSUED",
            subtotal: Number(tenant.monthly_rent),
            total_due: Number(tenant.monthly_rent),
            total_paid: 0,
            issued_at: new Date().toISOString(),
            due_date: targetMonth,
          })
          .select("id")
          .single();

        if (invError) {
          results.push(`${room.unit_code}: ERROR - ${invError.message}`);
          continue;
        }

        // Add rent line item
        await supabase.from("invoice_line_items").insert({
          invoice_id: invoice.id,
          category: "RENT",
          description: `Rent — ${new Date(targetMonth).toLocaleDateString("en-SG", { month: "long", year: "numeric" })}`,
          amount: Number(tenant.monthly_rent),
          billing_type: "PRE",
        });

        results.push(`${room.unit_code}: ${invoiceCode} created ($${tenant.monthly_rent})`);
      }
    } else {
      // POST phase: append AC overage + pending member charges
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, tenant_profile_id, room_id, subtotal, total_due, invoice_code")
        .eq("month", targetMonth)
        .in("status", ["ISSUED", "PARTIALLY_PAID"]);

      if (!invoices || invoices.length === 0) {
        return new Response(JSON.stringify({ phase, results: ["No open invoices for this month"] }), { status: 200 });
      }

      for (const inv of invoices) {
        let addedAmount = 0;

        // Check AC overage
        const { data: acUsage } = await supabase
          .from("ac_monthly_usage")
          .select("overage_hours, id")
          .eq("room_id", inv.room_id)
          .eq("month", targetMonth)
          .single();

        if (acUsage && Number(acUsage.overage_hours) > 0) {
          // Check if already added
          const { data: existingAC } = await supabase
            .from("invoice_line_items")
            .select("id")
            .eq("invoice_id", inv.id)
            .eq("category", "AC_OVERAGE")
            .limit(1);

          if (!existingAC || existingAC.length === 0) {
            const acAmount = Number(acUsage.overage_hours) * 0.30;
            await supabase.from("invoice_line_items").insert({
              invoice_id: inv.id,
              category: "AC_OVERAGE",
              description: `AC overage — ${acUsage.overage_hours} hours @ $0.30/hr`,
              amount: Math.round(acAmount * 100) / 100,
              billing_type: "POST",
              source_id: acUsage.id,
              source_table: "ac_monthly_usage",
            });
            addedAmount += acAmount;
          }
        }

        // Check pending member charges not yet on any invoice
        const { data: charges } = await supabase
          .from("member_charges")
          .select("id, description, amount, category")
          .eq("tenant_profile_id", inv.tenant_profile_id)
          .eq("status", "PENDING");

        if (charges) {
          for (const charge of charges) {
            // Check if already added
            const { data: existingCharge } = await supabase
              .from("invoice_line_items")
              .select("id")
              .eq("source_id", charge.id)
              .eq("source_table", "member_charges")
              .limit(1);

            if (!existingCharge || existingCharge.length === 0) {
              const cat = charge.category ?? "OTHER";
              await supabase.from("invoice_line_items").insert({
                invoice_id: inv.id,
                category: cat,
                description: charge.description,
                amount: Number(charge.amount),
                billing_type: "POST",
                source_id: charge.id,
                source_table: "member_charges",
              });
              addedAmount += Number(charge.amount);
            }
          }
        }

        if (addedAmount > 0) {
          const newSubtotal = Number(inv.subtotal) + addedAmount;
          await supabase
            .from("invoices")
            .update({
              subtotal: Math.round(newSubtotal * 100) / 100,
              total_due: Math.round(newSubtotal * 100) / 100,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id);
          results.push(`${inv.invoice_code}: added $${addedAmount.toFixed(2)} in post-consumption charges`);
        } else {
          results.push(`${inv.invoice_code}: no post-consumption charges`);
        }
      }
    }

    return new Response(JSON.stringify({ phase, month: targetMonth, results }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
