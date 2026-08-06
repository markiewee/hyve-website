# PRD: Landlord Portal v2 (owner doc viewing + passwordless access)

**Date:** 2026-08-06 · **Owner:** Mark · **Builder:** Claudine · **Branch/PR:** `feat/landlord-doc-downloads` / PR #19

## Problem
The CP #04-03 owner (Laurence Tan) has chased tenant IDs, passports and IPA letters for weeks. PR #19 added download buttons, but:
1. The PR cannot deploy: adding `api/portal/landlord-doc-url.js` took the repo to 13 serverless functions and the Vercel Hobby plan caps at 12 (`exceeded_serverless_functions_per_deployment`).
2. Owners want to SEE the documents in the portal, not just download files.
3. Only one seeded landlord login exists per property, with a password. Laurence and Josephine both need access, and neither should need to manage a password.

## Goals
1. PR #19 deploys green on Vercel Hobby (no paid upgrade, Cheap AF).
2. Landlord portal shows the actual passport/ID scans in-page (image and PDF), with download still available.
3. Laurence and Josephine each get their own account, linked to Chiltern Park.
4. Passwordless access: an email with a "View Portal" button signs them straight in (Supabase magic link). A "Property owner? Email me a sign-in link" option on the portal login page issues fresh links forever after.
5. Send both owners the access email once the flow is QA'd end to end (Mark authorized 6 Aug).

## Non-goals
- No exposure of licence agreements, stamp certs or payslips (protects sub-let margin + tenant finances). Visibility stays ID_DOCUMENT + PASSPORT only, current tenants only.
- No TG/IH owner rollout yet (owner_emails empty for those; same rails will work later).
- No Supabase built-in auth mailer (it only delivers to team emails). All email rides the proven notify-tenant → Resend pipeline (verified delivered to Mark 11:19am today).

## Design
**1. Function consolidation (deploy fix).** Move the landlord-doc-url handler into `api/portal/admin-actions.js` as `action: "landlord_doc_url"` with its own LANDLORD auth check (runs before the admin gate). Delete the standalone file. Back to 12 functions.

**2. Inline viewer.** `LandlordPage.jsx`: clicking a document chip opens a modal that fetches the same 1h signed URL and renders `<img>` for images or `<iframe>` for PDFs, with Download and Open-in-tab buttons. (CP's first doc, Anushka's passport, is a PDF, so PDF support is required day one.)

**3. Owner accounts.** Create confirmed auth users `laurencetan@live.com.sg` and `josephinelim@live.com.sg` + active LANDLORD `tenant_profiles` rows on CP. Existing `get_landlord_roster()` / `get_landlord_documents()` RPCs and the doc-url endpoint already key off the caller's property, so multiple landlords per property work unchanged.

**4. Magic link.** New unauthenticated `action: "owner_link_request"` in admin-actions: given an email, if (and only if) it belongs to an active LANDLORD, mint `supabase.auth.admin.generateLink(type: magiclink, redirectTo: /portal/landlord)` and email it via a new `OWNER_LOGIN_LINK` event in the notify-tenant edge function. Always responds `{ok:true}` (no account enumeration). Login page gets an "Owner sign-in" toggle (email only, no password). Auth config: set site_url to https://www.lazybee.sg, allow-list portal URLs, extend magic-link validity to 24h.

**5. Owner welcome email.** New `OWNER_WELCOME` event: explains the portal (roster + ID/passport docs for their unit), CTA is their personal magic link, plus one line on how to get a fresh link from the login page. BCc admin@lazybee.sg (existing pipeline behaviour).

## QA gate (before owners get the email)
- Local `vite build` passes; Vercel preview deploy green; function count = 12.
- RPC isolation re-check: CP landlord sees only CP docs.
- Full magic-link chain verified headlessly with a test owner account (Gmail plus-alias to Mark): request link → email lands → action_link redirects to /portal/landlord with a session token.
- Viewer renders Anushka's passport PDF via signed URL.

## Risks
- Magic links are single-use, 24h validity: mitigated by the self-serve "email me a sign-in link" on the login page.
- generateLink redirect falls back to site_url if allow-list is wrong: QA step checks the redirect Location explicitly.
- live.com.sg (Outlook) spam filtering: hello@lazybee.sg already sends via Resend with domain auth; if the owner email bounces, fall back is Mark forwarding the link.
