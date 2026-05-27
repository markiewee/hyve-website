import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/portal/claim-reserve
 * Body: { token, email, password, name?, move_in?, duration_months?, has_pass? }
 *
 * Creates a real Supabase auth user from a soft_reserves token, mints a
 * tenant_profile + onboarding_progress (idempotent), creates a Stripe customer,
 * and advances the reserve status to "account_created".
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, email, password, name, move_in, duration_months, has_pass } =
    req.body || {};

  if (!token || !email || !password) {
    return res
      .status(400)
      .json({ error: "token, email, and password are required" });
  }

  // 1. Load the soft_reserve by token.
  const { data: sr, error: srErr } = await supabase
    .from("soft_reserves")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (srErr) {
    console.error("[claim-reserve] soft_reserves lookup error:", srErr);
    return res.status(500).json({ error: "Failed to look up reserve" });
  }
  if (!sr) return res.status(404).json({ error: "reserve_not_found" });

  if (["won", "lost", "expired"].includes(sr.status)) {
    return res.status(409).json({ error: "reserve_closed" });
  }

  if (sr.expires_at && new Date(sr.expires_at) < new Date()) {
    return res.status(410).json({ error: "expired" });
  }

  // 2. Room-taken guard: another reserve for the same room already won.
  const { data: wonRows, error: wonErr } = await supabase
    .from("soft_reserves")
    .select("id")
    .eq("room_id", sr.room_id)
    .eq("status", "won");

  if (wonErr) {
    console.error("[claim-reserve] room-taken check error:", wonErr);
    return res.status(500).json({ error: "Failed to check room availability" });
  }
  if (wonRows && wonRows.length > 0) {
    return res.status(409).json({ error: "room_taken" });
  }

  // 3. Load room to compute rent / deposit.
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("price_monthly, deposit_months")
    .eq("id", sr.room_id)
    .maybeSingle();

  if (roomErr) {
    console.error("[claim-reserve] room lookup error:", roomErr);
    return res.status(500).json({ error: "Failed to load room" });
  }

  const monthly_rent = room ? Number(room.price_monthly) || null : null;
  const deposit_amount =
    room && room.deposit_months != null && room.price_monthly != null
      ? Number(room.deposit_months) * Number(room.price_monthly)
      : null;

  // 4. tenant_profile — idempotent.
  let tenantProfileId = sr.tenant_profile_id || null;

  if (!tenantProfileId) {
    const { data: profile, error: profErr } = await supabase
      .from("tenant_profiles")
      .insert({
        room_id: sr.room_id,
        property_id: sr.property_id,
        role: "TENANT",
        is_active: true,
        monthly_rent,
      })
      .select("id")
      .single();

    if (profErr) {
      console.error("[claim-reserve] tenant_profiles insert failed:", profErr);
      return res.status(500).json({ error: "Could not create tenant profile" });
    }

    tenantProfileId = profile.id;

    // Insert onboarding_progress for this new profile.
    const onboardingPayload = {
      tenant_profile_id: tenantProfileId,
      room_id: sr.room_id,
      current_step: "DEPOSIT",
      status: "ONBOARDING",
    };
    if (deposit_amount != null) onboardingPayload.deposit_amount = deposit_amount;
    const moveInDate = move_in || sr.preferred_move_in;
    if (moveInDate) onboardingPayload.tenancy_start_date = moveInDate;

    const { error: obErr } = await supabase
      .from("onboarding_progress")
      .insert(onboardingPayload);
    if (obErr) {
      console.error("[claim-reserve] onboarding_progress insert failed:", obErr);
    }
  }

  // 5. Auth user — idempotent.
  let userId = sr.user_id || null;

  if (!userId) {
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      // Fall back: find an existing user with this email.
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing =
        listData?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        ) || null;

      if (existing) {
        userId = existing.id;
      } else {
        return res.status(400).json({ error: authError.message });
      }
    } else {
      userId = authData.user.id;
    }

    // Create Stripe customer (best-effort).
    let stripeCustomerId = null;
    try {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          supabase_user_id: userId,
          tenant_profile_id: tenantProfileId,
        },
      });
      stripeCustomerId = customer.id;
    } catch (stripeError) {
      console.error("[claim-reserve] Stripe customer creation failed:", stripeError);
    }

    // Link user_id (and optionally stripe_customer_id) to the tenant_profile.
    const profileUpdate = { user_id: userId, is_active: true };
    if (stripeCustomerId) profileUpdate.stripe_customer_id = stripeCustomerId;

    const { error: profileUpdateErr } = await supabase
      .from("tenant_profiles")
      .update(profileUpdate)
      .eq("id", tenantProfileId);

    if (profileUpdateErr) {
      console.error("[claim-reserve] tenant_profiles update failed:", profileUpdateErr);
      return res
        .status(500)
        .json({ error: "Account created but profile link failed" });
    }
  }

  // 6. Advance the soft_reserve to account_created.
  const reserveUpdate = {
    status: "account_created",
    user_id: userId,
    tenant_profile_id: tenantProfileId,
    prospect_email: email,
    prospect_name: name || sr.prospect_name,
    preferred_move_in: move_in || sr.preferred_move_in,
    duration_months: duration_months ?? sr.duration_months,
    has_pass: has_pass === true,
    updated_at: new Date().toISOString(),
  };

  const { error: srUpdateErr } = await supabase
    .from("soft_reserves")
    .update(reserveUpdate)
    .eq("id", sr.id);

  if (srUpdateErr) {
    console.error("[claim-reserve] soft_reserves update failed:", srUpdateErr);
    return res.status(500).json({ error: "Account created but reserve update failed" });
  }

  return res.status(200).json({ ok: true });
}
