import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { invoice_id } = req.body;
  if (!invoice_id) {
    return res.status(400).json({ error: "invoice_id is required" });
  }

  // Fetch invoice
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, tenant_profiles(username, stripe_customer_id)")
    .eq("id", invoice_id)
    .single();

  if (error || !invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  if (invoice.status === "PAID" || invoice.status === "VOID") {
    return res.status(400).json({ error: "Invoice is already paid or voided" });
  }

  const outstanding = Number(invoice.total_due) - Number(invoice.total_paid);
  if (outstanding <= 0) {
    return res.status(400).json({ error: "No outstanding amount" });
  }

  // Add 4% processing fee
  const totalCents = Math.round(outstanding * 1.04 * 100);

  const sessionParams = {
    mode: "payment",
    currency: "sgd",
    line_items: [
      {
        price_data: {
          currency: "sgd",
          product_data: {
            name: `Invoice ${invoice.invoice_code} + 4% processing fee`,
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: invoice.id,
      invoice_code: invoice.invoice_code,
      type: "invoice",
    },
    success_url: `https://hyve.sg/portal/billing/${invoice.id}?paid=true`,
    cancel_url: `https://hyve.sg/portal/billing/${invoice.id}`,
  };

  // Attach Stripe customer if exists
  if (invoice.tenant_profiles?.stripe_customer_id) {
    sessionParams.customer = invoice.tenant_profiles.stripe_customer_id;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  // Store session URL on invoice
  await supabase
    .from("invoices")
    .update({ stripe_checkout_url: session.url, updated_at: new Date().toISOString() })
    .eq("id", invoice.id);

  return res.status(200).json({ url: session.url });
}
