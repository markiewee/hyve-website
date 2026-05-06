// /api/auth/google/login
// One-shot OAuth initiation. Admin only — gates behind admin session.
// Visit while logged in as admin to start consent flow that produces a
// refresh token. After consent, the callback will display the refresh
// token once. Copy it into Vercel env as GOOGLE_OAUTH_REFRESH_TOKEN.
//
// Spec: docs/superpowers/specs/2026-05-06-hyve-viewing-booking-v2-design.md

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

async function isAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const tokenFromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  // Allow ?token=... in case the admin opens the URL directly in a browser
  // and we expose a way to pass their access_token. In practice this route
  // is most easily called by an admin who pastes their access token; but we
  // also accept a one-time setup secret for bootstrapping.
  const tokenFromQuery = req.query?.token || null;
  const setupSecret = req.query?.setup_secret || null;

  if (setupSecret && process.env.OAUTH_SETUP_SECRET && setupSecret === process.env.OAUTH_SETUP_SECRET) {
    return true;
  }

  const token = tokenFromHeader || tokenFromQuery;
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .single();
  return !!profile && ["ADMIN", "SUPER_ADMIN"].includes(profile.role);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!(await isAdmin(req))) {
    return res
      .status(403)
      .send("Forbidden — admin only. Pass ?token=<access_token> or ?setup_secret=<env value>.");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return res
      .status(500)
      .json({ error: "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not configured" });
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh token even if previously granted
    scope: ["https://www.googleapis.com/auth/calendar"],
  });

  res.writeHead(302, { Location: url });
  res.end();
}
