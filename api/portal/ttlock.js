import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const TTLOCK_API = "https://euapi.ttlock.com/v3";
const CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_USERNAME = process.env.TTLOCK_USERNAME;
const TTLOCK_PASSWORD_MD5 = process.env.TTLOCK_PASSWORD_MD5; // MD5 hash of password

let cachedToken = null;
let tokenExpiry = 0;

// ── Get OAuth access token ──────────────────────────────────────
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const params = new URLSearchParams({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    username: TTLOCK_USERNAME,
    password: TTLOCK_PASSWORD_MD5,
  });

  const res = await fetch(`${TTLOCK_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.errcode) throw new Error(`TTLock auth failed: ${data.errmsg}`);

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 1 min early
  return cachedToken;
}

// ── TTLock API call helper ──────────────────────────────────────
async function ttlockCall(endpoint, params = {}) {
  const token = await getAccessToken();
  const body = new URLSearchParams({
    clientId: CLIENT_ID,
    accessToken: token,
    date: Date.now().toString(),
    ...params,
  });

  const res = await fetch(`${TTLOCK_API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`TTLock API error: ${data.errmsg} (${data.errcode})`);
  }
  return data;
}

// ── Verify admin caller ─────────────────────────────────────────
async function verifyAdmin(req) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return false;

  const { data: authData, error } = await supabase.auth.getUser(token);
  if (error || !authData?.user) return false;

  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .single();

  return profile?.role === "ADMIN";
}

// ── Main handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: "TTLock not configured. Add TTLOCK_CLIENT_ID, TTLOCK_CLIENT_SECRET, TTLOCK_USERNAME, TTLOCK_PASSWORD_MD5 to environment." });
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: "Admin role required" });

  const { action, ...params } = req.body || {};

  try {
    switch (action) {
      // ── List all locks ──────────────────────────────────────
      case "list_locks": {
        const data = await ttlockCall("/lock/list", {
          pageNo: params.pageNo || "1",
          pageSize: params.pageSize || "100",
        });
        return res.status(200).json(data);
      }

      // ── Get lock details ────────────────────────────────────
      case "lock_detail": {
        if (!params.lockId) return res.status(400).json({ error: "lockId required" });
        const data = await ttlockCall("/lock/detail", { lockId: params.lockId });
        return res.status(200).json(data);
      }

      // ── Generate a temporary passcode ───────────────────────
      case "generate_passcode": {
        if (!params.lockId) return res.status(400).json({ error: "lockId required" });

        const data = await ttlockCall("/keyboardPwd/get", {
          lockId: params.lockId,
          keyboardPwdType: params.type || "2", // 2 = permanent, 3 = one-time, 1 = timed
          keyboardPwdName: params.name || "Portal Generated",
          startDate: params.startDate || Date.now().toString(),
          endDate: params.endDate || (Date.now() + 365 * 24 * 60 * 60 * 1000).toString(), // 1 year default
        });

        // Save to DB
        if (data.keyboardPwdId) {
          await supabase.from("lock_passcodes").insert({
            lock_id: params.lockId,
            passcode_id: data.keyboardPwdId.toString(),
            passcode: data.keyboardPwd,
            type: params.type || "2",
            name: params.name || "Portal Generated",
            tenant_profile_id: params.tenantProfileId || null,
            room_id: params.roomId || null,
            start_date: params.startDate ? new Date(Number(params.startDate)).toISOString() : new Date().toISOString(),
            end_date: params.endDate ? new Date(Number(params.endDate)).toISOString() : null,
            is_active: true,
          }).select().single();
        }

        return res.status(200).json(data);
      }

      // ── Add a custom passcode ───────────────────────────────
      case "add_passcode": {
        if (!params.lockId || !params.passcode) {
          return res.status(400).json({ error: "lockId and passcode required" });
        }

        const data = await ttlockCall("/keyboardPwd/add", {
          lockId: params.lockId,
          keyboardPwd: params.passcode,
          keyboardPwdName: params.name || "Custom Code",
          keyboardPwdType: params.type || "2",
          startDate: params.startDate || Date.now().toString(),
          endDate: params.endDate || (Date.now() + 365 * 24 * 60 * 60 * 1000).toString(),
        });

        if (data.keyboardPwdId) {
          await supabase.from("lock_passcodes").insert({
            lock_id: params.lockId,
            passcode_id: data.keyboardPwdId.toString(),
            passcode: params.passcode,
            type: params.type || "2",
            name: params.name || "Custom Code",
            tenant_profile_id: params.tenantProfileId || null,
            room_id: params.roomId || null,
            start_date: params.startDate ? new Date(Number(params.startDate)).toISOString() : new Date().toISOString(),
            end_date: params.endDate ? new Date(Number(params.endDate)).toISOString() : null,
            is_active: true,
          });
        }

        return res.status(200).json(data);
      }

      // ── Delete a passcode ───────────────────────────────────
      case "delete_passcode": {
        if (!params.lockId || !params.passcodeId) {
          return res.status(400).json({ error: "lockId and passcodeId required" });
        }

        const data = await ttlockCall("/keyboardPwd/delete", {
          lockId: params.lockId,
          keyboardPwdId: params.passcodeId,
        });

        // Mark as inactive in DB
        await supabase
          .from("lock_passcodes")
          .update({ is_active: false })
          .eq("passcode_id", params.passcodeId);

        return res.status(200).json(data);
      }

      // ── List passcodes for a lock ───────────────────────────
      case "list_passcodes": {
        if (!params.lockId) return res.status(400).json({ error: "lockId required" });

        const data = await ttlockCall("/lock/listKeyboardPwd", {
          lockId: params.lockId,
          pageNo: params.pageNo || "1",
          pageSize: params.pageSize || "100",
        });
        return res.status(200).json(data);
      }

      // ── Get lock records (open/close history) ───────────────
      case "lock_records": {
        if (!params.lockId) return res.status(400).json({ error: "lockId required" });

        const data = await ttlockCall("/lockRecord/list", {
          lockId: params.lockId,
          pageNo: params.pageNo || "1",
          pageSize: params.pageSize || "20",
          startDate: params.startDate || (Date.now() - 7 * 24 * 60 * 60 * 1000).toString(),
          endDate: params.endDate || Date.now().toString(),
        });
        return res.status(200).json(data);
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("TTLock error:", err);
    return res.status(500).json({ error: err.message });
  }
}
