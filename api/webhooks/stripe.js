import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

// Disable Vercel's built-in body parser so we can read the raw body for
// Stripe signature verification.
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).json({ error: "Missing Stripe-Signature header" });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    const stripeInvoiceId = invoice.id;

    const { error } = await supabase
      .from("ac_monthly_usage")
      .update({ status: "PAID" })
      .eq("stripe_invoice_id", stripeInvoiceId);

    if (error) {
      console.error("Failed to update ac_monthly_usage for invoice.paid:", error);
      // Return 200 anyway — Stripe should not retry for DB errors on our side
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Handle invoice payments
    if (session.metadata?.type === "invoice") {
      const invoiceId = session.metadata.invoice_id;
      const amountPaid = session.amount_total / 100 / 1.04; // Remove 4% fee

      const { data: inv } = await supabase
        .from("invoices")
        .select("total_due, total_paid, invoice_code, tenant_profile_id")
        .eq("id", invoiceId)
        .single();

      if (inv) {
        const newTotalPaid = Number(inv.total_paid) + amountPaid;
        const fullyPaid = newTotalPaid >= Number(inv.total_due);

        await supabase
          .from("invoices")
          .update({
            total_paid: Math.round(newTotalPaid * 100) / 100,
            status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
            paid_at: fullyPaid ? new Date().toISOString() : null,
            stripe_checkout_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        // Fire INVOICE_PAID receipt only on full payment.
        if (fullyPaid && inv.tenant_profile_id) {
          try {
            await fetch(
              `${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/notify-tenant`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.IOT_SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  event_type: "INVOICE_PAID",
                  tenant_profile_id: inv.tenant_profile_id,
                  details: {
                    invoice_id: invoiceId,
                    invoice_code: inv.invoice_code,
                    amount: Math.round(newTotalPaid * 100) / 100,
                  },
                }),
              }
            );
          } catch (e) {
            console.error("notify-tenant INVOICE_PAID failed (non-blocking):", e);
          }
        }
      }
    }

    if (session.metadata?.type !== "invoice") {
      await supabase
        .from("onboarding_progress")
        .update({
          deposit_completed_at: new Date().toISOString(),
          deposit_verified: true,
          deposit_method: "STRIPE",
          current_step: "HOUSE_RULES",
        })
        .eq("deposit_stripe_session_id", session.id);
    }
  }

  return res.status(200).json({ received: true });
};
