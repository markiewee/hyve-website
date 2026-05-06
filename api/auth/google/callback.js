// /api/auth/google/callback
// OAuth callback. Exchanges code for tokens, displays refresh token ONCE so
// admin can copy into Vercel env (GOOGLE_OAUTH_REFRESH_TOKEN). Token is
// never persisted server-side — admin must save it themselves.

import { google } from "googleapis";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`<h1>OAuth error</h1><p>${escapeHtml(error)}</p>`);
  }
  if (!code) {
    return res.status(400).send("<h1>Missing code</h1>");
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

  try {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token;
    const accessToken = tokens.access_token;

    if (!refreshToken) {
      return res.status(500).send(`
        <h1>No refresh token returned</h1>
        <p>This usually happens if you've already granted consent before.
        Revoke at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>
        and try again — the login route forces <code>prompt=consent</code> but Google sometimes still
        skips it.</p>
      `);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Hyve OAuth — refresh token</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:760px;margin:48px auto;padding:0 16px;color:#121c2a}
  pre{background:#f3f4f6;padding:16px;border-radius:8px;word-break:break-all;white-space:pre-wrap;font-size:13px}
  .warn{background:#fff7ed;border:1px solid #fb923c;padding:16px;border-radius:8px;color:#9a3412}
  code{background:#f3f4f6;padding:2px 6px;border-radius:4px}
  h1{color:#006b5f}
</style></head><body>
<h1>Got a refresh token</h1>
<div class="warn">
  <strong>Copy this now — it will not be shown again.</strong><br>
  Add it to Vercel env as <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>, redeploy, then close this tab.
</div>
<h2>GOOGLE_OAUTH_REFRESH_TOKEN</h2>
<pre>${escapeHtml(refreshToken)}</pre>
<details>
  <summary>Access token (short-lived, for testing only)</summary>
  <pre>${escapeHtml(accessToken || "(none)")}</pre>
</details>
<h2>Next steps</h2>
<ol>
  <li>Vercel → Project → Settings → Environment Variables → add
    <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> with the value above. Apply to Production + Preview + Development.</li>
  <li>Make sure <code>HYVE_VIEWINGS_CAL_ID</code> is also set (the calendar ID, e.g.
    <code>abc...@group.calendar.google.com</code>).</li>
  <li>Redeploy.</li>
  <li>Test: hit <code>/api/book/slots?property=IH&amp;date=YYYY-MM-DD</code>.</li>
</ol>
</body></html>`);
  } catch (err) {
    return res.status(500).send(`<h1>Token exchange failed</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
}
