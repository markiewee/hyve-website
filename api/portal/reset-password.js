import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const PORTAL_DOMAIN = "@portal.lazybee.sg";
const TOKEN_TTL_MINUTES = 60;
const SITE_BASE = process.env.SITE_BASE_URL || "https://www.lazybee.sg";

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function invokeNotify(tenantProfileId, resetUrl) {
  const url = `${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/notify-tenant`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.IOT_SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      event_type: "PASSWORD_RESET",
      tenant_profile_id: tenantProfileId,
      details: { reset_url: resetUrl, expires_in_minutes: TOKEN_TTL_MINUTES },
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`notify-tenant ${r.status}: ${text.slice(0, 400)}`);
}

async function handleRequest(req, res) {
  const { username } = req.body || {};
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username required" });
  }
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return res.status(400).json({ error: "username required" });

  const email = cleanUsername.includes("@")
    ? cleanUsername
    : `${cleanUsername}${PORTAL_DOMAIN}`;

  // Always respond with the same success shape — don't reveal account existence.
  const okPayload = { ok: true };

  const { data: users, error: lookupErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (lookupErr) {
    console.error("listUsers failed:", lookupErr);
    return res.status(okPayload ? 200 : 500).json(okPayload);
  }
  const user = users?.users?.find((u) => u.email?.toLowerCase() === email);
  if (!user) return res.status(200).json(okPayload);

  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!profile) return res.status(200).json(okPayload);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertErr } = await supabase.from("password_reset_tokens").insert({
    tenant_profile_id: profile.id,
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    requested_ip:
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || null,
  });
  if (insertErr) {
    console.error("token insert failed:", insertErr);
    return res.status(200).json(okPayload);
  }

  const resetUrl = `${SITE_BASE}/portal/reset-password?token=${rawToken}`;

  try {
    await invokeNotify(profile.id, resetUrl);
  } catch (err) {
    console.error("notify-tenant failed:", err);
    // Still return success — user shouldn't learn whether email was deliverable.
  }

  return res.status(200).json(okPayload);
}

async function handleConfirm(req, res) {
  const { token, new_password } = req.body || {};
  if (!token || !new_password) {
    return res.status(400).json({ error: "token and new_password required" });
  }
  if (typeof new_password !== "string" || new_password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const tokenHash = sha256(token);
  const { data: row } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!row) return res.status(400).json({ error: "Invalid or expired link." });
  if (row.used_at) return res.status(400).json({ error: "This reset link has already been used." });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: "This reset link has expired. Request a new one." });
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(row.user_id, {
    password: new_password,
  });
  if (updateErr) {
    console.error("password update failed:", updateErr);
    return res.status(500).json({ error: "Could not update password. Try again." });
  }

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action } = req.body || {};
  if (action === "request") return handleRequest(req, res);
  if (action === "confirm") return handleConfirm(req, res);
  return res.status(400).json({ error: `Unknown action: ${action}` });
}
