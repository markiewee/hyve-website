import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { onboarding_id, charge_id, invoice_id, type = "deposit" } = req.body || {};

  // ── Invoice flow ── (no bearer required — matches original /invoice-checkout behavior)
  if (type === "invoice") {
    if (!invoice_id) return res.status(400).json({ error: "invoice_id is required" });

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*, tenant_profiles(username, stripe_customer_id)")
      .eq("id", invoice_id)
      .single();

    if (error || !invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      return res.status(400).json({ error: "Invoice is already paid or voided" });
    }

    const outstanding = Number(invoice.total_due) - Number(invoice.total_paid);
    if (outstanding <= 0) return res.status(400).json({ error: "No outstanding amount" });

    const totalCents = Math.round(outstanding * 1.04 * 100);
    const sessionParams = {
      mode: "payment",
      currency: "sgd",
      line_items: [{
        price_data: {
          currency: "sgd",
          product_data: { name: `Invoice ${invoice.invoice_code} + 4% processing fee` },
          unit_amount: totalCents,
        },
        quantity: 1,
      }],
      metadata: { invoice_id: invoice.id, invoice_code: invoice.invoice_code, type: "invoice" },
      success_url: `https://lazybee.sg/portal/billing/${invoice.id}?paid=true`,
      cancel_url: `https://lazybee.sg/portal/billing/${invoice.id}`,
    };

    if (invoice.tenant_profiles?.stripe_customer_id) {
      sessionParams.customer = invoice.tenant_profiles.stripe_customer_id;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    await supabase
      .from("invoices")
      .update({ stripe_checkout_url: session.url, updated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    return res.status(200).json({ url: session.url, checkout_url: session.url });
  }

  // ── Reserve deposit (soft-reserve flow, no bearer — reserve token is the credential) ──
  if (type === "reserve_deposit") {
    const token = req.body?.token;
    if (!token) return res.status(400).json({ error: "token is required" });

    const { data: sr, error: srErr } = await supabase
      .from("soft_reserves")
      .select("id, room_id, status, tenant_profile_id")
      .eq("token", token)
      .maybeSingle();
    if (srErr || !sr) return res.status(404).json({ error: "reserve_not_found" });
    if (["won", "lost", "expired"].includes(sr.status)) return res.status(409).json({ error: "reserve_closed" });

    // Room-taken guard: someone already won this room.
    const { data: wonRow } = await supabase
      .from("soft_reserves").select("id").eq("room_id", sr.room_id).eq("status", "won").maybeSingle();
    if (wonRow) return res.status(409).json({ error: "room_taken" });

    // Deposit amount from the onboarding row created at account creation; fallback to room calc.
    let depositAmount = null;
    if (sr.tenant_profile_id) {
      const { data: ob } = await supabase
        .from("onboarding_progress").select("deposit_amount").eq("tenant_profile_id", sr.tenant_profile_id).maybeSingle();
      if (ob?.deposit_amount != null) depositAmount = Number(ob.deposit_amount);
    }
    if (depositAmount == null) {
      const { data: room } = await supabase.from("rooms").select("price_monthly, deposit_months").eq("id", sr.room_id).maybeSingle();
      if (room?.price_monthly != null && room?.deposit_months != null) depositAmount = Number(room.price_monthly) * Number(room.deposit_months);
    }
    if (depositAmount == null || depositAmount <= 0) return res.status(400).json({ error: "deposit_amount_unavailable" });

    // 3% card service fee (note: differs from the 4% used on the standard onboarding deposit).
    const totalCents = Math.round(depositAmount * 1.03 * 100);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        currency: "sgd",
        line_items: [{
          price_data: { currency: "sgd", product_data: { name: "Security Deposit + 3% card fee" }, unit_amount: totalCents },
          quantity: 1,
        }],
        metadata: { type: "reserve_deposit", soft_reserve_token: token, room_id: sr.room_id },
        success_url: `https://hyve-booking.vercel.app/reserved/${token}?deposit=success`,
        cancel_url: `https://hyve-booking.vercel.app/reserved/${token}?deposit=cancel`,
      });
      await supabase.from("soft_reserves").update({ stripe_session_id: session.id, updated_at: new Date().toISOString() }).eq("id", sr.id);
      return res.status(200).json({ checkout_url: session.url });
    } catch (err) {
      console.error("[reserve_deposit] stripe error:", err);
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  }

  // ── Deposit and charge flows require bearer token ──
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // ── Pay a charge via Stripe ──
  if (type === "charge" && charge_id) {
    const { data: charge, error: chargeErr } = await supabase
      .from("member_charges")
      .select("*, tenant_profiles(user_id)")
      .eq("id", charge_id)
      .single();

    if (chargeErr || !charge) return res.status(404).json({ error: "Charge not found" });
    if (charge.tenant_profiles?.user_id !== authData.user.id) return res.status(403).json({ error: "Not authorised" });
    if (charge.status === "PAID") return res.status(400).json({ error: "Already paid" });

    const totalCents = Math.round(Number(charge.amount) * 1.04 * 100);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        currency: "sgd",
        line_items: [{
          price_data: { currency: "sgd", product_data: { name: `${charge.description} + 4% processing fee` }, unit_amount: totalCents },
          quantity: 1,
        }],
        metadata: { charge_id: charge.id, type: "charge" },
        success_url: `https://lazybee.sg/portal/billing?charge_paid=${charge.id}`,
        cancel_url: "https://lazybee.sg/portal/billing",
      });

      return res.status(200).json({ checkout_url: session.url });
    } catch (err) {
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  }

  // ── Deposit checkout (original flow) ──
  if (!onboarding_id) {
    return res.status(400).json({ error: "onboarding_id is required" });
  }

  const { data: onboarding, error: onboardingError } = await supabase
    .from("onboarding_progress")
    .select("*, tenant_profiles(id, user_id)")
    .eq("id", onboarding_id)
    .single();

  if (onboardingError || !onboarding) {
    return res.status(404).json({ error: "Onboarding record not found" });
  }

  if (onboarding.tenant_profiles?.user_id !== authData.user.id) {
    return res.status(403).json({ error: "Not authorised" });
  }

  if (!onboarding.deposit_amount) {
    return res.status(400).json({ error: "Deposit amount not set" });
  }

  const totalCents = Math.round(onboarding.deposit_amount * 1.04 * 100);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "sgd",
      line_items: [{
        price_data: {
          currency: "sgd",
          product_data: { name: "Security Deposit + 4% fee" },
          unit_amount: totalCents,
        },
        quantity: 1,
      }],
      success_url: "https://lazybee.sg/portal/onboarding?deposit=success",
      cancel_url: "https://lazybee.sg/portal/onboarding?deposit=cancel",
    });

    await supabase
      .from("onboarding_progress")
      .update({
        deposit_stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", onboarding_id);

    return res.status(200).json({ checkout_url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
