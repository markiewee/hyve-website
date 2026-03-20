import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const FREE_HOURS = 300;
const OVERAGE_RATE_SGD = 0.30; // SGD per hour

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function calculateHours(
  events: { state: string; timestamp: string }[],
  periodEnd: Date
): number {
  let totalMs = 0;
  let onStart: Date | null = null;

  for (const event of events) {
    const ts = new Date(event.timestamp);
    if (event.state === "ON") {
      if (!onStart) {
        onStart = ts;
      }
    } else if (event.state === "OFF") {
      if (onStart) {
        totalMs += ts.getTime() - onStart.getTime();
        onStart = null;
      }
    }
  }

  if (onStart) {
    totalMs += periodEnd.getTime() - onStart.getTime();
  }

  return totalMs / (1000 * 60 * 60);
}

Deno.serve(async (_req) => {
  const now = new Date();

  // Previous month
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const monthLabel = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;
  const monthStart = new Date(prevYear, prevMonth, 1).toISOString();
  const monthEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);
  const daysInMonth = getDaysInMonth(prevYear, prevMonth);

  // Fetch all rooms
  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id");

  if (roomsError || !rooms) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch rooms", detail: roomsError }),
      { status: 500 }
    );
  }

  const results: {
    room_id: string;
    total_hours: number;
    free_hours: number;
    overage_hours: number;
    billed: boolean;
    invoice_id?: string;
  }[] = [];

  for (const room of rooms) {
    // Fetch events for previous month
    const { data: events, error: eventsError } = await supabase
      .from("ac_events")
      .select("state, timestamp")
      .eq("room_id", room.id)
      .gte("timestamp", monthStart)
      .lte("timestamp", monthEnd.toISOString())
      .order("timestamp", { ascending: true });

    if (eventsError) {
      console.error(`Failed to fetch events for room ${room.id}:`, eventsError);
      continue;
    }

    const totalHours = calculateHours(events ?? [], monthEnd);

    // Fetch tenant profile
    const { data: profile, error: profileError } = await supabase
      .from("tenant_profiles")
      .select("id, stripe_customer_id, moved_in_at, moved_out_at")
      .eq("room_id", room.id)
      .eq("is_active", true)
      .single();

    if (profileError || !profile) {
      // No active tenant — skip billing, still store usage
      await supabase.from("ac_monthly_usage").upsert(
        { room_id: room.id, month: monthLabel, total_hours: totalHours },
        { onConflict: "room_id,month" }
      );
      results.push({
        room_id: room.id,
        total_hours: totalHours,
        free_hours: FREE_HOURS,
        overage_hours: 0,
        billed: false,
      });
      continue;
    }

    // Calculate days occupied in the billing month
    const movedIn = profile.moved_in_at ? new Date(profile.moved_in_at) : null;
    const movedOut = profile.moved_out_at ? new Date(profile.moved_out_at) : null;

    const occupancyStart = movedIn && movedIn > new Date(monthStart)
      ? movedIn
      : new Date(monthStart);
    const occupancyEnd = movedOut && movedOut < monthEnd
      ? movedOut
      : monthEnd;

    const daysOccupied = Math.max(
      0,
      Math.ceil(
        (occupancyEnd.getTime() - occupancyStart.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    // Prorate free hours
    const proratedFreeHours = FREE_HOURS * (daysOccupied / daysInMonth);
    const overageHours = Math.max(0, totalHours - proratedFreeHours);

    let stripeInvoiceId: string | undefined;
    let stripeHostedUrl: string | undefined;
    let billed = false;

    if (overageHours > 0 && profile.stripe_customer_id) {
      try {
        // Create and send Stripe invoice
        const invoice = await stripe.invoices.create({
          customer: profile.stripe_customer_id,
          collection_method: "send_invoice",
          days_until_due: 14,
          description: `Hyve AC overage — ${monthLabel}`,
          metadata: {
            room_id: room.id,
            month: monthLabel,
            overage_hours: overageHours.toFixed(2),
          },
        });

        await stripe.invoiceItems.create({
          customer: profile.stripe_customer_id,
          invoice: invoice.id,
          description: `AC overage: ${overageHours.toFixed(2)} hours @ SGD $${OVERAGE_RATE_SGD}/hr`,
          amount: Math.round(overageHours * OVERAGE_RATE_SGD * 100), // cents
          currency: "sgd",
        });

        const sentInvoice = await stripe.invoices.sendInvoice(invoice.id);
        stripeInvoiceId = sentInvoice.id;
        stripeHostedUrl = sentInvoice.hosted_invoice_url ?? undefined;
        billed = true;
      } catch (stripeError) {
        console.error(`Stripe billing failed for room ${room.id}:`, stripeError);
      }
    }

    // Upsert ac_monthly_usage
    const upsertPayload: Record<string, unknown> = {
      room_id: room.id,
      month: monthLabel,
      total_hours: totalHours,
      free_hours: proratedFreeHours,
      overage_hours: overageHours,
    };
    if (stripeInvoiceId) upsertPayload.stripe_invoice_id = stripeInvoiceId;
    if (stripeHostedUrl) upsertPayload.stripe_hosted_url = stripeHostedUrl;

    await supabase
      .from("ac_monthly_usage")
      .upsert(upsertPayload, { onConflict: "room_id,month" });

    results.push({
      room_id: room.id,
      total_hours: totalHours,
      free_hours: proratedFreeHours,
      overage_hours: overageHours,
      billed,
      invoice_id: stripeInvoiceId,
    });
  }

  return new Response(JSON.stringify({ month: monthLabel, results }), {
    status: 200,
  });
});
