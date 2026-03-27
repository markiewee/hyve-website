import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

// ── Verify admin caller ─────────────────────────────────────────
async function verifyAdmin(req) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: authData, error } = await supabase.auth.getUser(token);
  if (error || !authData?.user) return null;
  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .single();
  if (!profile || profile.role !== "ADMIN") return null;
  return authData.user;
}

// ── Reset Password ──────────────────────────────────────────────
async function handleResetPassword(req, res) {
  const { user_id, new_password } = req.body || {};
  if (!user_id || !new_password) return res.status(400).json({ error: "user_id and new_password required" });
  if (new_password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const { error } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

// ── Notify (email) ──────────────────────────────────────────────
async function handleNotify(req, res) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  const secret = req.headers["x-notify-secret"];
  if (secret !== process.env.NOTIFY_SECRET) return res.status(401).json({ error: "Unauthorized" });
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: "to, subject, and html required" });
  try {
    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({ from: "Hyve <onboarding@resend.dev>", to, subject, html });
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── TTLock ───────────────────────────────────────────────────────
const TTLOCK_API = "https://euapi.ttlock.com/v3";
let cachedToken = null;
let tokenExpiry = 0;

async function getTTLockToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const params = new URLSearchParams({
    clientId: process.env.TTLOCK_CLIENT_ID,
    clientSecret: process.env.TTLOCK_CLIENT_SECRET,
    username: process.env.TTLOCK_USERNAME,
    password: process.env.TTLOCK_PASSWORD_MD5,
  });
  const r = await fetch(`${TTLOCK_API}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  const d = await r.json();
  if (d.errcode) throw new Error(`TTLock auth: ${d.errmsg}`);
  cachedToken = d.access_token;
  tokenExpiry = Date.now() + (d.expires_in - 60) * 1000;
  return cachedToken;
}

async function ttlockCall(endpoint, params = {}) {
  const token = await getTTLockToken();
  const body = new URLSearchParams({ clientId: process.env.TTLOCK_CLIENT_ID, accessToken: token, date: Date.now().toString(), ...params });
  const r = await fetch(`${TTLOCK_API}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  const d = await r.json();
  if (d.errcode && d.errcode !== 0) throw new Error(`TTLock: ${d.errmsg} (${d.errcode})`);
  return d;
}

async function handleTTLock(req, res) {
  if (!process.env.TTLOCK_CLIENT_ID) return res.status(500).json({ error: "TTLock not configured" });
  const { ttlock_action, ...params } = req.body;
  try {
    switch (ttlock_action) {
      case "list_locks": return res.json(await ttlockCall("/lock/list", { pageNo: "1", pageSize: "100" }));
      case "lock_detail": return res.json(await ttlockCall("/lock/detail", { lockId: params.lockId }));
      case "generate_passcode": {
        const d = await ttlockCall("/keyboardPwd/get", { lockId: params.lockId, keyboardPwdType: params.type || "2", keyboardPwdName: params.name || "Portal", startDate: params.startDate || Date.now().toString(), endDate: params.endDate || (Date.now() + 365*24*60*60*1000).toString() });
        if (d.keyboardPwdId) await supabase.from("lock_passcodes").insert({ lock_id: params.lockId, passcode_id: d.keyboardPwdId.toString(), passcode: d.keyboardPwd, type: params.type || "2", name: params.name, tenant_profile_id: params.tenantProfileId || null, is_active: true });
        return res.json(d);
      }
      case "add_passcode": {
        const d = await ttlockCall("/keyboardPwd/add", { lockId: params.lockId, keyboardPwd: params.passcode, keyboardPwdName: params.name || "Custom", keyboardPwdType: params.type || "2", startDate: params.startDate || Date.now().toString(), endDate: params.endDate || (Date.now() + 365*24*60*60*1000).toString() });
        if (d.keyboardPwdId) await supabase.from("lock_passcodes").insert({ lock_id: params.lockId, passcode_id: d.keyboardPwdId.toString(), passcode: params.passcode, type: params.type || "2", name: params.name, tenant_profile_id: params.tenantProfileId || null, is_active: true });
        return res.json(d);
      }
      case "delete_passcode": {
        const d = await ttlockCall("/keyboardPwd/delete", { lockId: params.lockId, keyboardPwdId: params.passcodeId });
        await supabase.from("lock_passcodes").update({ is_active: false }).eq("passcode_id", params.passcodeId);
        return res.json(d);
      }
      case "list_passcodes": return res.json(await ttlockCall("/lock/listKeyboardPwd", { lockId: params.lockId, pageNo: "1", pageSize: "100" }));
      case "lock_records": return res.json(await ttlockCall("/lockRecord/list", { lockId: params.lockId, pageNo: "1", pageSize: "20", startDate: params.startDate || (Date.now() - 7*24*60*60*1000).toString(), endDate: params.endDate || Date.now().toString() }));
      default: return res.status(400).json({ error: `Unknown ttlock_action: ${ttlock_action}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Aspire API Proxy ─────────────────────────────────────────────
const ASPIRE_API = "https://api.aspireapp.com/public/v1";
let aspireToken = null;
let aspireTokenExpiry = 0;

async function getAspireToken() {
  if (aspireToken && Date.now() < aspireTokenExpiry) return aspireToken;
  const clientId = process.env.VITE_ASPIRE_CLIENT_ID;
  const apiKey = process.env.VITE_ASPIRE_API_KEY;
  if (!clientId || !apiKey) throw new Error("Aspire not configured. Set VITE_ASPIRE_CLIENT_ID and VITE_ASPIRE_API_KEY.");
  const r = await fetch(`${ASPIRE_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: apiKey }),
  });
  if (!r.ok) throw new Error(`Aspire auth failed: ${await r.text()}`);
  const d = await r.json();
  aspireToken = d.access_token;
  aspireTokenExpiry = Date.now() + ((d.expires_in || 1800) - 60) * 1000;
  return aspireToken;
}

async function handleAspire(req, res) {
  const { aspire_action, ...params } = req.body;
  try {
    const token = await getAspireToken();
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    switch (aspire_action) {
      case "accounts": {
        const r = await fetch(`${ASPIRE_API}/accounts`, { headers });
        return res.json(await r.json());
      }
      case "transactions": {
        const { account_id, from_date, to_date, page, per_page } = params;
        // Aspire requires ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ
        const toIso = (d) => d ? (d.includes("T") ? d : `${d}T00:00:00Z`) : null;
        const qs = new URLSearchParams();
        if (from_date) qs.set("start_date", toIso(from_date));
        if (to_date) qs.set("end_date", toIso(to_date));
        if (account_id) qs.set("account_id", account_id);
        if (page) qs.set("page", String(page));
        if (per_page) qs.set("per_page", String(per_page));
        const url = `${ASPIRE_API}/transactions${qs.toString() ? `?${qs.toString()}` : ""}`;
        const r = await fetch(url, { headers });
        return res.json(await r.json());
      }
      case "balance": {
        if (!params.account_id) return res.status(400).json({ error: "account_id required" });
        const r = await fetch(`${ASPIRE_API}/accounts/${params.account_id}/balance`, { headers });
        return res.json(await r.json());
      }
      default:
        return res.status(400).json({ error: `Unknown aspire_action: ${aspire_action}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Main Router ─────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action } = req.body || {};

  // Notify doesn't need admin auth (uses x-notify-secret)
  if (action === "notify") return handleNotify(req, res);

  // Everything else needs admin
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: "Admin role required" });

  switch (action) {
    case "reset_password": return handleResetPassword(req, res);
    case "ttlock": return handleTTLock(req, res);
    case "aspire": return handleAspire(req, res);
    default: return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
