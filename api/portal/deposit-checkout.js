const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify bearer token
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const { onboarding_id } = req.body || {};

  if (!onboarding_id) {
    return res.status(400).json({ error: "onboarding_id is required" });
  }

  // Fetch onboarding record
  const { data: onboarding, error: onboardingError } = await supabase
    .from("onboarding_progress")
    .select("*, tenant_profiles(id, user_id)")
    .eq("id", onboarding_id)
    .single();

  if (onboardingError || !onboarding) {
    return res.status(404).json({ error: "Onboarding record not found" });
  }

  // Verify ownership
  if (onboarding.tenant_profiles?.user_id !== authData.user.id) {
    return res.status(403).json({ error: "Not authorised" });
  }

  if (!onboarding.deposit_amount) {
    return res.status(400).json({ error: "Deposit amount not set" });
  }

  // Calculate total with 4% fee, rounded to cents
  const totalCents = Math.round(onboarding.deposit_amount * 1.04 * 100);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "sgd",
      line_items: [
        {
          price_data: {
            currency: "sgd",
            product_data: {
              name: "Security Deposit + 4% fee",
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      success_url: "https://hyve.sg/portal/onboarding?deposit=success",
      cancel_url: "https://hyve.sg/portal/onboarding?deposit=cancel",
    });

    // Store session ID on onboarding record
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
};
