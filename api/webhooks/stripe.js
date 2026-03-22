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

  return res.status(200).json({ received: true });
};
