import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Portal base URL. Defaults to the current live host (no-op until portal.lazybee.sg
// DNS is live — then set PORTAL_BASE_URL=https://portal.lazybee.sg).
const PORTAL_URL = process.env.PORTAL_BASE_URL || "https://lazybee.sg";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Lazybee Co-living <hello@lazybee.sg>",
        reply_to: "hello@lazybee.sg",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("[stripe webhook] sendEmail failed:", e);
  }
}

function depositReceiptHtml({ name, roomLabel, deposit }) {
  const amount = deposit != null ? `$${Number(deposit).toLocaleString()}` : "your deposit";
  return `<p>Hi ${name || "there"},</p>
<p>Great news — we've received and confirmed ${amount} as the deposit for <strong>${roomLabel}</strong> (card payment). <strong>The room is yours.</strong></p>
<p><strong>Next step:</strong> log in to your portal with your email and password to finish onboarding — sign your agreement, upload your ID, and get your move-in details.</p>
<p style="margin:24px 0"><a href="${PORTAL_URL}/portal/login" style="background:#c9a96a;color:#000;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600">Log in to the portal</a></p>
<p style="color:#888;font-size:13px">Keep this email as your deposit receipt. See you soon — Hyve.</p>`;
}

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

    if (session.metadata?.type === "reserve_deposit") {
      // Soft-reserve deposit → first paid deposit wins the room.
      const token = session.metadata.soft_reserve_token;
      const roomId = session.metadata.room_id;
      if (token && roomId) {
        // Already won by someone else?
        const { data: alreadyWon } = await supabase
          .from("soft_reserves").select("id").eq("room_id", roomId).eq("status", "won").maybeSingle();
        if (alreadyWon) {
          // This payer lost the race → refund and mark lost.
          try {
            if (session.payment_intent) await stripe.refunds.create({ payment_intent: session.payment_intent });
          } catch (e) { console.error("[reserve_deposit] refund failed:", e); }
          await supabase.from("soft_reserves")
            .update({ status: "lost", updated_at: new Date().toISOString() })
            .eq("token", token);
        } else {
          // Winner: mark won, knock out siblings on the same room.
          await supabase.from("soft_reserves")
            .update({ status: "won", updated_at: new Date().toISOString() })
            .eq("token", token);
          await supabase.from("soft_reserves")
            .update({ status: "lost", updated_at: new Date().toISOString() })
            .eq("room_id", roomId)
            .neq("token", token)
            .in("status", ["reserved", "account_created", "deposit_pending"]);

          // Advance onboarding + email the guest their deposit receipt.
          const { data: sr } = await supabase
            .from("soft_reserves")
            .select("prospect_name, prospect_email, tenant_profile_id")
            .eq("token", token)
            .maybeSingle();
          if (sr?.tenant_profile_id) {
            await supabase.from("onboarding_progress")
              .update({ deposit_completed_at: new Date().toISOString(), deposit_verified: true, deposit_method: "STRIPE", current_step: "HOUSE_RULES" })
              .eq("tenant_profile_id", sr.tenant_profile_id);
          }
          if (sr?.prospect_email) {
            const { data: room } = await supabase
              .from("rooms").select("name, unit_code, price_monthly, deposit_months").eq("id", roomId).maybeSingle();
            const roomLabel = room?.name || room?.unit_code || "your room";
            const deposit = room ? Number(room.price_monthly) * (Number(room.deposit_months) || 1) : null;
            await sendEmail(
              sr.prospect_email,
              `Deposit confirmed — you've secured ${roomLabel}`,
              depositReceiptHtml({ name: sr.prospect_name, roomLabel, deposit })
            );
          }
        }
      }
    }

    if (session.metadata?.type !== "invoice" && session.metadata?.type !== "reserve_deposit") {
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
