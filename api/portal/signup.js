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

  const { email, password, token } = req.body || {};

  if (!email || !password || !token) {
    return res.status(400).json({ error: "email, password, and token are required" });
  }

  // Look up the invite by token in tenant_profiles first
  const { data: profile, error: profileError } = await supabase
    .from("tenant_profiles")
    .select("id, invite_expires_at, user_id")
    .eq("invite_token", token)
    .is("user_id", null)
    .single();

  if (!profileError && profile) {
    // --- Tenant signup flow ---
    if (profile.invite_expires_at && new Date(profile.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: "Invite has expired" });
    }

    // Create the auth user (email already confirmed)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // Create Stripe customer
    let stripeCustomerId = null;
    try {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId, tenant_profile_id: profile.id },
      });
      stripeCustomerId = customer.id;
    } catch (stripeError) {
      console.error("Stripe customer creation failed:", stripeError);
      // Don't fail the whole signup — Stripe can be linked later
    }

    // Claim the profile: set user_id, clear token, set stripe customer id
    const updatePayload = {
      user_id: userId,
      invite_token: null,
      is_active: true,
    };
    if (stripeCustomerId) {
      updatePayload.stripe_customer_id = stripeCustomerId;
    }

    const { error: updateError } = await supabase
      .from("tenant_profiles")
      .update(updatePayload)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Profile update failed:", updateError);
      return res.status(500).json({ error: "Account created but profile link failed" });
    }

    return res.status(200).json({ ok: true });
  }

  // --- Fallback: check investors table for matching invite_token ---
  const { data: investor, error: investorError } = await supabase
    .from("investors")
    .select("id, invite_expires_at, user_id")
    .eq("invite_token", token)
    .is("user_id", null)
    .single();

  if (investorError || !investor) {
    return res.status(400).json({ error: "Invalid or already-used invite token" });
  }

  if (investor.invite_expires_at && new Date(investor.invite_expires_at) < new Date()) {
    return res.status(400).json({ error: "Invite has expired" });
  }

  // Create the auth user for investor (no Stripe)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = authData.user.id;

  // Claim the investor row: set user_id, clear token, activate
  const { error: updateError } = await supabase
    .from("investors")
    .update({
      user_id: userId,
      invite_token: null,
      is_active: true,
    })
    .eq("id", investor.id);

  if (updateError) {
    console.error("Investor update failed:", updateError);
    return res.status(500).json({ error: "Account created but investor profile link failed" });
  }

  return res.status(200).json({ ok: true });
};
