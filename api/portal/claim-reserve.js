import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Portal base URL. Defaults to the current live host (no-op until portal.lazybee.sg
// DNS is live — then set PORTAL_BASE_URL=https://portal.lazybee.sg).
const PORTAL_URL = process.env.PORTAL_BASE_URL || "https://lazybee.sg";

const PROOF_BUCKET = "deposit_proofs";
const ADMIN_EMAILS = (process.env.RESERVE_NOTIFY_TO || "admin@hyve.sg,mark@meetmillia.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Send via Resend — the portal's email transport (RESEND_API_KEY). Verified sender
// matches the notify-tenant edge function: "Lazybee Co-living <hello@lazybee.sg>".
async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const r = await fetch("https://api.resend.com/emails", {
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
  const text = await r.text();
  if (!r.ok) throw new Error(`resend ${r.status}: ${text.slice(0, 300)}`);
  return text;
}

function depositReceiptHtml({ name, roomLabel, deposit, method }) {
  const amount = deposit != null ? `$${Number(deposit).toLocaleString()}` : "your deposit";
  return `<p>Hi ${name || "there"},</p>
<p>Great news — we've received and confirmed ${amount} as the deposit for <strong>${roomLabel}</strong>${method ? ` (${method})` : ""}. <strong>The room is yours.</strong></p>
<p><strong>Next step:</strong> log in to your portal with your email and password to finish onboarding — sign your agreement, upload your ID, and get your move-in details.</p>
<p style="margin:24px 0"><a href="${PORTAL_URL}/portal/login" style="background:#c9a96a;color:#000;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600">Log in to the portal</a></p>
<p style="color:#888;font-size:13px">Keep this email as your deposit receipt. See you soon — Hyve.</p>`;
}

function confirmPage(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#0d0d10;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="max-width:440px;text-align:center">
<p style="font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#c9a96a;margin:0 0 12px">Lazybee · Hyve</p>
<h1 style="font-weight:300;font-size:30px;line-height:1.2;margin:0 0 14px">${title}</h1>
<p style="color:#b8b8bd;font-size:15px;line-height:1.6;margin:0">${body}</p>
</div></body></html>`;
}

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

  // ── GET ?confirm_token=… → Mark clicks the confirm link in his email.
  // Atomically assigns the room to this reserve (bank-transfer deposit verified).
  if (req.method === "GET") {
    const confirmToken = String(req.query?.confirm_token || "").trim();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!confirmToken) return res.status(400).send(confirmPage("Invalid link", "This confirm link is missing its token."));

    const { data: sr } = await supabase
      .from("soft_reserves")
      .select("id, token, room_id, status, tenant_profile_id, prospect_name, prospect_email")
      .eq("confirm_token", confirmToken)
      .maybeSingle();
    if (!sr) return res.status(404).send(confirmPage("Link not found", "We couldn't find this reservation. It may have been removed."));

    if (sr.status === "won")
      return res.status(200).send(confirmPage("Already confirmed", "This room is already assigned to this guest. Nothing more to do."));

    // Room taken by another reserve → tell Mark to refund this transfer manually.
    const { data: otherWon } = await supabase
      .from("soft_reserves")
      .select("id").eq("room_id", sr.room_id).eq("status", "won").neq("id", sr.id).maybeSingle();
    if (otherWon) {
      await supabase.from("soft_reserves").update({ status: "lost", updated_at: new Date().toISOString() }).eq("id", sr.id);
      return res.status(200).send(confirmPage("Room already taken", "Someone else secured this room first. Please refund this guest's bank transfer manually — no room was assigned."));
    }

    // Winner: mark won, knock out siblings, advance onboarding past the deposit step.
    await supabase.from("soft_reserves").update({ status: "won", updated_at: new Date().toISOString() }).eq("id", sr.id);
    await supabase.from("soft_reserves")
      .update({ status: "lost", updated_at: new Date().toISOString() })
      .eq("room_id", sr.room_id).neq("id", sr.id).in("status", ["reserved", "account_created", "deposit_pending"]);
    if (sr.tenant_profile_id) {
      await supabase.from("onboarding_progress")
        .update({ deposit_completed_at: new Date().toISOString(), deposit_verified: true, deposit_method: "BANK_TRANSFER", current_step: "HOUSE_RULES" })
        .eq("tenant_profile_id", sr.tenant_profile_id);
    }
    // Receipt: confirm to the guest that their deposit is verified and the room is theirs.
    if (sr.prospect_email) {
      try {
        const { data: room } = await supabase
          .from("rooms").select("name, unit_code, price_monthly, deposit_months").eq("id", sr.room_id).maybeSingle();
        const roomLabel = room?.name || room?.unit_code || "your room";
        const deposit = room ? Number(room.price_monthly) * (Number(room.deposit_months) || 1) : null;
        await sendEmail(
          sr.prospect_email,
          `Deposit confirmed — you've secured ${roomLabel}`,
          depositReceiptHtml({ name: sr.prospect_name, roomLabel, deposit, method: "bank transfer" })
        );
      } catch (e) {
        console.error("[claim-reserve] deposit receipt email failed:", e);
      }
    }
    return res.status(200).send(confirmPage("Room confirmed ✓", `${sr.prospect_name || "The guest"} now holds this room. They can finish onboarding in the portal.`));
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── notify_proof: a bank-transfer screenshot was uploaded. Email the prospect
  // ("confirm in 2-4h") and Mark (screenshot + one-click confirm link).
  if (req.body?.action === "notify_proof") {
    const token = String(req.body.token || "").trim();
    if (!token) return res.status(400).json({ error: "token required" });

    const { data: sr } = await supabase
      .from("soft_reserves")
      .select("id, room_id, prospect_name, prospect_email, deposit_proof_url, confirm_token")
      .eq("token", token)
      .maybeSingle();
    if (!sr) return res.status(404).json({ error: "reserve_not_found" });

    const { data: room } = await supabase
      .from("rooms").select("name, unit_code, price_monthly").eq("id", sr.room_id).maybeSingle();
    const roomLabel = room ? `${room.name || room.unit_code || "your room"}` : "your room";

    let proofUrl = null;
    if (sr.deposit_proof_url) {
      const { data: signed } = await supabase.storage
        .from(PROOF_BUCKET).createSignedUrl(sr.deposit_proof_url, 60 * 60 * 24 * 3);
      proofUrl = signed?.signedUrl || null;
    }
    // No screenshot → nothing to verify. Don't send a confirm email.
    if (!proofUrl) {
      console.error("[claim-reserve] notify_proof: no screenshot for token", token, "— skipping email");
      return res.status(422).json({ error: "no_screenshot", emailed: false });
    }
    const confirmLink = `https://www.lazybee.sg/api/portal/claim-reserve?confirm_token=${sr.confirm_token}`;

    try {
      if (sr.prospect_email) {
        await sendEmail(
          sr.prospect_email,
          `We've got your deposit for ${roomLabel}`,
          `<p>Hi ${sr.prospect_name || "there"},</p>
<p>Thanks — we've received your bank transfer screenshot for <strong>${roomLabel}</strong>. We'll verify it and confirm your room by email within <strong>2–4 hours</strong>.</p>
<p>Hang tight — nothing more to do for now.</p><p>— Hyve</p>`
        );
      }
      await sendEmail(
        ADMIN_EMAILS,
        `Deposit proof — ${sr.prospect_name || "prospect"} · ${roomLabel}`,
        `<p><strong>${sr.prospect_name || "A prospect"}</strong> (${sr.prospect_email || "no email"}) uploaded a bank-transfer screenshot for <strong>${roomLabel}</strong>${room?.price_monthly ? ` ($${Number(room.price_monthly).toLocaleString()}/mo)` : ""}.</p>
${proofUrl ? `<p><a href="${proofUrl}">View the screenshot</a> (link valid 3 days)</p>` : "<p>(screenshot link unavailable)</p>"}
<p style="margin:24px 0"><a href="${confirmLink}" style="background:#c9a96a;color:#000;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600">Confirm &amp; assign room</a></p>
<p style="color:#888;font-size:13px">Clicking confirms the deposit and locks the room to this guest. If the room's already taken, you'll be told to refund the transfer manually.</p>`
      );
    } catch (e) {
      console.error("[claim-reserve] notify_proof email failed:", e);
      return res.status(200).json({ ok: true, emailed: false });
    }
    return res.status(200).json({ ok: true, emailed: true });
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
      // Email already exists → reuse that auth user (spec: match by email).
      // auth.admin.listUsers() returns empty in this project, so resolve the id
      // via generateLink, which looks the user up server-side and sends no email.
      let existingId = null;
      try {
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        existingId = linkData?.user?.id || null;
      } catch (e) {
        console.error("[claim-reserve] generateLink lookup failed:", e);
      }
      if (existingId) {
        userId = existingId;
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
