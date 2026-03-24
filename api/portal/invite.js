import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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

  // Check the caller has ADMIN role
  const { data: callerProfile, error: profileError } = await supabase
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin role required" });
  }

  const { room_id, property_id, role = "TENANT", deposit_amount, username } = req.body || {};

  if (!room_id || !property_id) {
    return res.status(400).json({ error: "room_id and property_id are required" });
  }

  // ── Username-based flow: create auth user + profile immediately ──
  if (username) {
    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters (letters, numbers, hyphens, underscores)" });
    }

    // Check username not taken
    const { data: existing } = await supabase
      .from("tenant_profiles")
      .select("id")
      .eq("username", cleanUsername)
      .single();
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const placeholderEmail = `${cleanUsername}@portal.hyve.sg`;
    const defaultPassword = "Welcome1!";

    // Create auth user
    const { data: authUser, error: authCreateError } = await supabase.auth.admin.createUser({
      email: placeholderEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { username: cleanUsername, needs_email_setup: true },
    });

    if (authCreateError) {
      console.error("Error creating auth user:", authCreateError);
      return res.status(500).json({ error: "Failed to create user account" });
    }

    // Create tenant profile
    const { data: newProfile, error: insertError } = await supabase
      .from("tenant_profiles")
      .insert({
        user_id: authUser.user.id,
        room_id,
        property_id,
        role,
        username: cleanUsername,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error creating profile:", insertError);
      return res.status(500).json({ error: "Failed to create tenant profile" });
    }

    // Create onboarding_progress
    const onboardingPayload = {
      tenant_profile_id: newProfile.id,
      room_id,
      current_step: "PERSONAL_DETAILS",
      status: "ONBOARDING",
    };
    if (deposit_amount != null) onboardingPayload.deposit_amount = deposit_amount;

    await supabase.from("onboarding_progress").insert(onboardingPayload);

    return res.status(200).json({
      profile_id: newProfile.id,
      username: cleanUsername,
      default_password: defaultPassword,
      login_url: "https://hyve.sg/portal/login",
      message: `Tenant can login with username "${cleanUsername}" and password "${defaultPassword}". They will be prompted to set their email on first login.`,
    });
  }

  // ── Traditional invite-link flow ──
  const invite_token = crypto.randomBytes(32).toString("hex");
  const invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newProfile, error: insertError } = await supabase
    .from("tenant_profiles")
    .insert({
      room_id,
      property_id,
      role,
      invite_token,
      invite_expires_at,
      is_active: false,
    })
    .select("id, invite_expires_at")
    .single();

  if (insertError) {
    console.error("Error creating invite profile:", insertError);
    return res.status(500).json({ error: "Failed to create invite" });
  }

  // Create onboarding_progress record for this tenant
  const onboardingPayload = {
    tenant_profile_id: newProfile.id,
    room_id,
    current_step: "PERSONAL_DETAILS",
    status: "ONBOARDING",
  };

  if (deposit_amount != null) {
    onboardingPayload.deposit_amount = deposit_amount;
  }

  const { error: onboardingError } = await supabase
    .from("onboarding_progress")
    .insert(onboardingPayload);

  if (onboardingError) {
    console.error("Error creating onboarding_progress:", onboardingError);
  }

  const invite_url = `https://hyve.sg/portal/signup?token=${invite_token}`;

  return res.status(200).json({
    invite_url,
    expires_at: newProfile.invite_expires_at,
    profile_id: newProfile.id,
  });
};
