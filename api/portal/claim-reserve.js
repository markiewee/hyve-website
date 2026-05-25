import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const SIGNUP_BASE = "https://lazybee.sg/portal/signup?token=";
const EXPIRED_URL = "https://hyve-booking.vercel.app/"; // hold lapsed → back to listings

/**
 * Public endpoint. Turns a booking-site "Reserve without deposit" token into a real
 * portal invite, then sends the prospect into the existing signup → onboarding → deposit
 * flow. Mirrors api/portal/invite.js (invite-link branch) but with NO admin auth — it's
 * gated by possession of a valid, unexpired reserve token (same trust model as signup.js).
 *
 *   GET  /api/portal/claim-reserve?token=<reserveToken>  → 302 to the signup URL
 *   POST /api/portal/claim-reserve   { token }           → { invite_url }
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const isGet = req.method === "GET";
  const token = isGet ? req.query?.token : req.body?.token;
  const respond = (status, jsonBody, redirectUrl) => {
    if (isGet && redirectUrl) {
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
    }
    return res.status(status).json(jsonBody);
  };

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!token) return res.status(400).json({ error: "Missing reserve token" });

  // 1. Look up the reserve (service role bypasses RLS).
  const { data: rv, error: rvErr } = await supabase
    .from("property_viewings")
    .select("id, room_id, property_id, prospect_name, prospect_phone, prospect_email, preferred_move_in, is_reserve, portal_invite_token")
    .eq("token", token)
    .maybeSingle();

  if (rvErr || !rv) return respond(404, { error: "Reservation not found" }, EXPIRED_URL);
  if (!rv.is_reserve) {
    return respond(400, { error: "Not a reservation" }, EXPIRED_URL);
  }

  // 2. Idempotency — already minted: reuse the existing invite.
  if (rv.portal_invite_token) {
    return respond(200, { invite_url: SIGNUP_BASE + rv.portal_invite_token }, SIGNUP_BASE + rv.portal_invite_token);
  }

  // 3. Fetch the room + validate the hold is still live.
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("price_monthly, deposit_months, held_until, name")
    .eq("id", rv.room_id)
    .maybeSingle();

  if (roomErr || !room) return respond(404, { error: "Room not found" }, EXPIRED_URL);

  const heldUntil = room.held_until ? new Date(room.held_until) : null;
  if (!heldUntil || heldUntil.getTime() < Date.now()) {
    return respond(410, { error: "Hold has expired" }, EXPIRED_URL);
  }

  // 4. Mint the invite (mirror invite.js invite-link branch).
  const invite_token = crypto.randomBytes(32).toString("hex");
  const monthly_rent = Number(room.price_monthly) || null;
  const deposit_amount =
    room.deposit_months != null && room.price_monthly != null
      ? Number(room.deposit_months) * Number(room.price_monthly)
      : null;

  const { data: profile, error: profErr } = await supabase
    .from("tenant_profiles")
    .insert({
      room_id: rv.room_id,
      property_id: rv.property_id,
      role: "TENANT",
      invite_token,
      invite_expires_at: heldUntil.toISOString(),
      is_active: true,
      monthly_rent,
    })
    .select("id")
    .single();

  if (profErr) {
    console.error("[claim-reserve] profile insert failed:", profErr.message);
    return respond(500, { error: "Could not create invite" }, EXPIRED_URL);
  }

  const onboardingPayload = {
    tenant_profile_id: profile.id,
    room_id: rv.room_id,
    current_step: "PERSONAL_DETAILS",
    status: "ONBOARDING",
  };
  if (deposit_amount != null) onboardingPayload.deposit_amount = deposit_amount;
  if (rv.preferred_move_in) onboardingPayload.tenancy_start_date = rv.preferred_move_in;

  const { error: obErr } = await supabase.from("onboarding_progress").insert(onboardingPayload);
  if (obErr) console.error("[claim-reserve] onboarding insert failed:", obErr.message);

  // 5. Link the reserve → invite for idempotency.
  await supabase.from("property_viewings").update({ portal_invite_token: invite_token }).eq("id", rv.id);

  const invite_url = SIGNUP_BASE + invite_token;
  return respond(200, { invite_url }, invite_url);
}
