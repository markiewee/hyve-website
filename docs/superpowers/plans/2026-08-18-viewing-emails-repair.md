# Lazybee Viewing Emails Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the day-before viewing reminder actually send again, and put every prospect-facing viewing email on the Lazybee design system instead of the pre-redesign teal layout.

**Architecture:** The reminder sweep moves off the Vercel cron (whose target deployment URL now redirects to Vercel SSO) and onto pg_cron on hyve-iot, which already runs twelve jobs reliably and calls edge functions with a vault-held service role key. The six viewing email templates come out of `viewing-notify/index.ts` into a pure, testable `_shared/viewingEmails.js` that renders through the same `_shared/emailShell.js` the tenant emails already use, so there is one email design system rather than two.

**Tech Stack:** Supabase edge functions (Deno), pg_cron + pg_net + Supabase Vault, Node `node --test` for the template tests, Vercel serverless functions for the booking API.

---

## Background: what is actually broken

Verified on production on 18 Aug 2026:

1. `property_viewings.reminder_24h_sent_at` was last set on **17 Jul 2026**. Wei Wee's 15 Aug viewing had a real email address, sat squarely inside the sweep window, and got nothing.
2. The sender is healthy. Firing `viewing-reminder-24h` by hand at the edge function returned `{"sent":true,"to":"markwee99@gmail.com","cc":"admin@meetmillia.com"}` and the mail arrived. The break is the trigger, not the email.
3. The trigger is `vercel.json` cron `{"path": "/api/booking/cron", "schedule": "0 12 * * *"}`. The route itself is alive (`https://www.lazybee.sg/api/booking/cron` returns `403 Forbidden` from `authorizedCron`, which is correct). But Vercel crons hit the **deployment** URL, and `https://hyve-website-<hash>.vercel.app/api/booking/cron` returns `302` to `vercel.com/sso-api` because the project's `ssoProtection.deploymentType` is `prod_deployment_urls_and_all_previews`.
4. Every viewing email still renders through a local `shell()` at `supabase/functions/viewing-notify/index.ts:168` using `#006b5f` teal and a system sans stack. Design system v1.0 lives in `supabase/functions/_shared/emailShell.js` and only `notify-tenant/index.ts` imports it.
5. The confirmation email promises "a reminder 24 hours and 2 hours before". No 2h reminder exists in code, only an unused `reminder_2h_sent_at` column.
6. `captain_id` is null on all four upcoming viewings, so `loadCaptain` returns its `"House Captain"` placeholder and the confirmation prints `House captain: House Captain`. Edward Jeremy Lo (property IH, `3949b484-3cd3-4f08-97d0-ed13520e8d32`) and Sophia (property TG, `afa5f5fd-701b-4efd-b499-75e4349b7a42`) are both active `HOUSE_CAPTAIN` rows with `property_id` set. Chiltern Park has no captain.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/functions/_shared/viewingEmails.js` (create) | All six viewing/lead email templates, plus `fmtDateTime`, `buildIcs`, `mapsUrl`. Pure functions, no Deno or Supabase imports, so `node --test` can run them. |
| `supabase/functions/_shared/viewingEmails.test.js` (create) | Asserts the old teal is gone, the design tokens are present, the 2h promise is gone, and the placeholder captain name never reaches a rendered email. |
| `supabase/functions/viewing-notify/index.ts` (modify) | Keeps the server, Supabase lookups, Resend transport and dispatch switch. Loses its private `shell()`, `detailsTable()`, `escapeHtml`, `fmtDateTime`, `buildIcs`, `b64` and all six templates. Gains the captain-by-property fallback. |
| `supabase/migrations/20260824000000_viewing_reminder_sweep.sql` (create) | `fn_viewing_reminder_sweep()` plus the pg_cron schedule that owns the day-before reminder. |
| `api/booking/[...path].js` (modify) | Drops the 24h block from `handleCron` so pg_cron is the only owner and there is no double-send race. Keeps the off-horizon lead sweep. |

## Task 1: Extract the viewing templates onto the design system

**Files:**
- Create: `supabase/functions/_shared/viewingEmails.js`
- Test: `supabase/functions/_shared/viewingEmails.test.js`

- [ ] **Step 1: Write the failing test**

```js
// Run with: node --test supabase/functions/_shared/viewingEmails.test.js
//
// The viewing emails drifted a full design generation behind the tenant emails
// because they carried their own private shell. These tests fail the moment
// that happens again.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tplConfirmation,
  tplCaptainNotify,
  tplAdminNotify,
  tplReminder24h,
  tplCancelled,
  tplOffHorizonReminder,
} from "./viewingEmails.js";

const viewing = {
  id: "8be235ce-e86c-4494-ba34-918083c2c3a9",
  prospect_name: "Mark",
  prospect_email: "markwee99@gmail.com",
  prospect_phone: "+6581333757",
  source: "direct",
  slot_start: "2026-08-22T05:15:00+00:00",
  slot_end: "2026-08-22T05:45:00+00:00",
  properties: {
    name: "Ivory Heights 122",
    code: "IH",
    address: "#08-33, Blk 122 Jurong East St 13, Singapore 600122",
    default_access_code: "808855",
    default_security_instructions: "Block 122 Jurong East St 13. Tell the guard you are visiting Hyve.",
  },
  rooms: { name: "IH Standard Room 1", unit_code: "IH-SR1" },
};
const captain = { name: "Edward Jeremy Lo", phone: "+65 83654765" };
const cancelUrl = "https://www.lazybee.sg/leads/close?t=abc";

const ALL = () => [
  tplConfirmation({ viewing, captain, cancelUrl }),
  tplCaptainNotify({ viewing, captainName: captain.name }),
  tplAdminNotify({ viewing }),
  tplReminder24h({ viewing, captain, cancelUrl }),
  tplCancelled({ viewing, recipientType: "prospect", cancelUrl }),
  tplCancelled({ viewing, recipientType: "captain", cancelUrl }),
  tplCancelled({ viewing, recipientType: "admin", cancelUrl }),
  tplOffHorizonReminder({ name: "Mark", property_interest: ["Ivory Heights 122"], intent: { target_move_in_date: "October 2026" } }),
];

test("no viewing email carries the pre-redesign teal shell", () => {
  for (const email of ALL()) {
    assert.ok(!email.html.includes("#006b5f"), `${email.subject} still uses the old teal`);
    assert.ok(!email.html.includes("#f8f9ff"), `${email.subject} still uses the old panel`);
  }
});

test("every viewing email renders through the design system", () => {
  for (const email of ALL()) {
    assert.ok(email.html.includes("#B08D4F"), `${email.subject} is missing the brass accent`);
    assert.ok(email.html.includes("Cormorant Garamond"), `${email.subject} is missing the headline face`);
    assert.ok(email.html.includes("JetBrains Mono"), `${email.subject} is missing the mono face`);
  }
});

test("the confirmation no longer promises a 2h reminder we never send", () => {
  const { html } = tplConfirmation({ viewing, captain, cancelUrl });
  assert.ok(!html.includes("2 hours"), "confirmation still promises a 2h reminder");
  assert.ok(html.includes("the day before"), "confirmation should promise the day-before mail");
});

test("the day-before email carries the door code and the way in", () => {
  const { html } = tplReminder24h({ viewing, captain, cancelUrl });
  assert.ok(html.includes("808855"), "missing the door code");
  assert.ok(html.includes("Tell the guard"), "missing the security instructions");
  assert.ok(html.includes("Edward Jeremy Lo"), "missing the captain");
});

test("a viewing with no captain never prints the placeholder at a reader", () => {
  const noCaptain = { name: "House Captain", phone: null };
  const conf = tplConfirmation({ viewing, captain: noCaptain, cancelUrl });
  assert.ok(!conf.html.includes("House Captain"), "placeholder captain name leaked into the confirmation");
  const rem = tplReminder24h({ viewing, captain: noCaptain, cancelUrl });
  assert.ok(!rem.html.includes("House Captain"), "placeholder captain name leaked into the reminder");
});

test("prospect emails point at the address on a map", () => {
  const conf = tplConfirmation({ viewing, captain, cancelUrl });
  assert.ok(conf.html.includes("google.com/maps"), "confirmation has no directions link");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-website && node --test supabase/functions/_shared/viewingEmails.test.js`
Expected: FAIL with `Cannot find module .../viewingEmails.js`

- [ ] **Step 3: Write the module**

Create `supabase/functions/_shared/viewingEmails.js` with the content given in Appendix A of this plan. It exports `fmtDateTime`, `buildIcs`, `b64`, `mapsUrl`, and the six `tpl*` builders, all rendering through `generic` from `./emailShell.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-website && node --test supabase/functions/_shared/viewingEmails.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/viewingEmails.js supabase/functions/_shared/viewingEmails.test.js
git commit -m "feat(email): viewing templates on the shared design system"
```

## Task 2: Point viewing-notify at the shared templates

**Files:**
- Modify: `supabase/functions/viewing-notify/index.ts`

- [ ] **Step 1: Add the import**

At the top of the file, directly under the `createClient` import:

```ts
import {
  fmtDateTime,
  buildIcs,
  b64,
  tplConfirmation,
  tplCaptainNotify,
  tplAdminNotify,
  tplReminder24h,
  tplCancelled,
  tplOffHorizonReminder,
} from "../_shared/viewingEmails.js";
```

- [ ] **Step 2: Delete the superseded local code**

Delete these from `viewing-notify/index.ts`, all of which now live in the shared module: `escapeHtml`, `fmtDateTime`, `b64`, `buildIcs`, `shell`, `detailsTable`, `tplConfirmation`, `tplCaptainNotify`, `tplAdminNotify`, `tplReminder24h`, `tplCancelled`, `tplOffHorizonReminder`. Leave `whatsAppOffHorizonText` where it is: it is plain text for Beeper, not email.

- [ ] **Step 3: Give loadCaptain a property fallback**

Replace `loadCaptain` with:

```ts
async function loadCaptain(
  captain_id: string | null,
  property_id?: string | null
): Promise<{ email: string | null; name: string; phone: string | null }> {
  let id = captain_id;

  // Bookings do not always carry a captain, and until now that printed the
  // literal string "House Captain" at the prospect. Every property that has a
  // captain has exactly one active HOUSE_CAPTAIN row carrying its property_id,
  // so fall back to that. Chiltern Park has none, which is a real answer, not
  // a bug: those emails read as self-serve with the door code.
  if (!id && property_id) {
    const { data: byProperty } = await supabase
      .from("tenant_profiles")
      .select("id")
      .eq("role", "HOUSE_CAPTAIN")
      .eq("property_id", property_id)
      .eq("is_active", true)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    id = byProperty?.id ?? null;
  }

  if (!id) return { email: null, name: "House Captain", phone: null };

  const { data: captain } = await supabase
    .from("tenant_profiles")
    .select("user_id, tenant_details(full_name, email, phone)")
    .eq("id", id)
    .single();
  let email = captain?.tenant_details?.email || null;
  const name = captain?.tenant_details?.full_name || "House Captain";
  const phone = captain?.tenant_details?.phone || null;
  if (!email && captain?.user_id) {
    const { data: userData } = await supabase.auth.admin.getUserById(captain.user_id);
    email = userData?.user?.email || null;
  }
  return { email, name, phone };
}
```

- [ ] **Step 4: Pass the property to loadCaptain at the one call site**

In `dispatch`, change the captain load so it can fall back:

```ts
const captain = await loadCaptain(viewing.captain_id, viewing.property_id);
```

- [ ] **Step 5: Type-check the function bundle**

Run: `cd /Users/mark/Desktop/hyve-website && npx --yes supabase@latest functions deploy viewing-notify --project-ref diiilqpfmlxjwiaeophb --no-verify-jwt=false --dry-run 2>&1 | tail -5`
Expected: a bundle succeeds, or if `--dry-run` is unsupported on the installed CLI, run the real deploy in Task 5 and treat a bundle error there as this step failing.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/viewing-notify/index.ts
git commit -m "refactor(viewing-notify): one email shell, and resolve the captain by property"
```

## Task 3: Move the day-before sweep onto pg_cron

**Files:**
- Create: `supabase/migrations/20260824000000_viewing_reminder_sweep.sql`

- [ ] **Step 1: Write the migration**

```sql
-- The day-before viewing reminder stopped sending on 17 Jul 2026.
--
-- It was triggered by a Vercel cron on /api/booking/cron. Vercel crons hit the
-- deployment URL, and this project's deployment URLs are behind SSO
-- (ssoProtection.deploymentType = prod_deployment_urls_and_all_previews), so
-- the request now 302s to vercel.com/sso-api and never reaches the handler.
-- The route itself is fine: www.lazybee.sg/api/booking/cron still answers 403
-- from its own auth gate. Nobody noticed for a month because the only signal
-- was an email that failed to arrive.
--
-- pg_cron already runs twelve jobs on this project and is the most reliable
-- scheduler we have, so the sweep moves here. It is the same window logic the
-- Vercel handler used (12h to 36h ahead, confirmed, not already reminded) and
-- the edge function still owns stamping reminder_24h_sent_at, so a failed send
-- is retried on the next run rather than silently marked done.

create or replace function public.fn_viewing_reminder_sweep()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  n integer := 0;
begin
  for v in
    select id
      from public.property_viewings
     where status = 'confirmed'
       and reminder_24h_sent_at is null
       and slot_start >= now() + interval '12 hours'
       and slot_start <= now() + interval '36 hours'
  loop
    perform net.http_post(
      url     := 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/viewing-notify',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (
                     select decrypted_secret from vault.decrypted_secrets
                      where name = 'SERVICE_ROLE_KEY')),
      body    := jsonb_build_object(
                   'event', 'viewing-reminder-24h',
                   'viewing_id', v.id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.unschedule('viewing-reminder-24h')
 where exists (select 1 from cron.job where jobname = 'viewing-reminder-24h');

-- 12:00 UTC is 20:00 Singapore, the evening before, which is what the email
-- itself says. Every slot falls inside exactly one run's 12-36h window.
select cron.schedule(
  'viewing-reminder-24h',
  '0 12 * * *',
  $cron$ select public.fn_viewing_reminder_sweep(); $cron$
);
```

- [ ] **Step 2: Verify the vault secret the migration depends on exists**

Run:
```bash
set -a; source ~/.chudbrain/secrets.env; set +a
curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select name from vault.decrypted_secrets where name = '"'"'SERVICE_ROLE_KEY'"'"';"}'
```
Expected: `[{"name":"SERVICE_ROLE_KEY"}]`. If it is empty, stop: the migration will queue unauthenticated requests. Add the secret first with `select vault.create_secret('<service role key>', 'SERVICE_ROLE_KEY');`

- [ ] **Step 3: Apply the migration to production**

Run the migration body through the Management API query endpoint against `diiilqpfmlxjwiaeophb`.
Expected: the `cron.schedule` call returns a jobid.

- [ ] **Step 4: Verify the job is registered**

Run:
```bash
set -a; source ~/.chudbrain/secrets.env; set +a
curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select jobid, jobname, schedule, active from cron.job where jobname = '"'"'viewing-reminder-24h'"'"';"}'
```
Expected: one active row on `0 12 * * *`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260824000000_viewing_reminder_sweep.sql
git commit -m "fix(viewings): the day-before reminder runs on pg_cron, not a cron that cannot reach us"
```

## Task 4: Give the sweep exactly one owner

**Files:**
- Modify: `api/booking/[...path].js` (the 24h block inside `handleCron`)

- [ ] **Step 1: Remove the 24h sweep from the Vercel handler**

Replace the block that starts `// Daily cron — broadened window 12-36h` and ends at the `return res.status(200).json({...})` with:

```js
  // The 24h viewing reminder used to live here. It now runs as the pg_cron job
  // `viewing-reminder-24h` on hyve-iot, because Vercel crons hit the deployment
  // URL and this project's deployment URLs sit behind SSO, so this handler
  // stopped being reachable on 17 Jul 2026 and the reminder silently died.
  // Two schedulers writing the same flag would race, so there is only one.
  // The off-horizon lead sweep above still runs here and is still exposed to
  // the same reachability problem: tracked separately.

  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    off_horizon: offHorizonSweep,
    reminder_24h: { moved_to: "pg_cron:viewing-reminder-24h" },
  });
}
```

- [ ] **Step 2: Verify nothing else referenced the removed variables**

Run: `cd /Users/mark/Desktop/hyve-website && grep -n "due24\|err24\|lo24\|hi24\|r24" "api/booking/[...path].js"`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `cd /Users/mark/Desktop/hyve-website && npx eslint "api/booking/[...path].js"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "api/booking/[...path].js"
git commit -m "fix(cron): stop scheduling the viewing reminder twice"
```

## Task 5: Deploy and prove it on production

- [ ] **Step 1: Deploy the edge function**

Run: `cd /Users/mark/Desktop/hyve-website && npx --yes supabase@latest functions deploy viewing-notify --project-ref diiilqpfmlxjwiaeophb`
Expected: `Deployed Functions on project diiilqpfmlxjwiaeophb: viewing-notify`

- [ ] **Step 2: Send one real confirmation and one real day-before mail to Mark's own address**

Mark has two real viewings on 22 Aug booked to `markwee99@gmail.com`. Fire both events at one of them, then reset the flag so the live run still happens:

```bash
set -a; source ~/.chudbrain/secrets.env; set +a
SRK=$(curl -s "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/api-keys?reveal=true" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  | python3 -c "import json,sys;print([k['api_key'] for k in json.load(sys.stdin) if k.get('name')=='service_role'][0])")
for EV in viewing-confirmation viewing-reminder-24h; do
  curl -s -X POST "https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/viewing-notify" \
    -H "Content-Type: application/json" -H "Authorization: Bearer $SRK" \
    -d "{\"event\":\"$EV\",\"viewing_id\":\"8be235ce-e86c-4494-ba34-918083c2c3a9\"}"
  echo
done
```
Expected: `{"sent":true,...}` twice.

- [ ] **Step 3: Read the delivered mail, do not trust the 200**

Search Gmail for `from:hello@lazybee.sg newer_than:1h` and open both. Confirm: alabaster background, brass eyebrow rule, Cormorant headline, the captain reads "Edward Jeremy Lo" and not "House Captain", the confirmation says "the day before" and not "2 hours", and the day-before mail carries door code `808855` and the guard instruction.

- [ ] **Step 4: Reset the probe flag**

```bash
set -a; source ~/.chudbrain/secrets.env; set +a
curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"update public.property_viewings set reminder_24h_sent_at = null where id = '"'"'8be235ce-e86c-4494-ba34-918083c2c3a9'"'"';"}'
```

- [ ] **Step 5: Prove the sweep itself selects the right rows**

Call the sweep function directly. On 18 Aug there is nothing in the 12-36h window, so the honest expected answer is 0, which proves it runs without proving it selects. So also run the selection query with a widened window covering 22 Aug and confirm it returns the three 22 Aug viewings.

```bash
set -a; source ~/.chudbrain/secrets.env; set +a
curl -s -X POST "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select public.fn_viewing_reminder_sweep() as fired; select count(*) as would_fire_on_21_aug from public.property_viewings where status='"'"'confirmed'"'"' and reminder_24h_sent_at is null and slot_start >= timestamptz '"'"'2026-08-21 12:00+00'"'"' + interval '"'"'12 hours'"'"' and slot_start <= timestamptz '"'"'2026-08-21 12:00+00'"'"' + interval '"'"'36 hours'"'"';"}'
```
Expected: `fired` = 0 today, `would_fire_on_21_aug` = 3 (Mark x2, Stephanie). Stephanie has no email on file so the edge function will skip her with `{"skipped":"no prospect email"}`, which is correct.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin fix/viewing-emails-reminder-and-design
gh pr create --title "fix: the day-before viewing email sends again, on the real design system" --body-file docs/superpowers/plans/2026-08-18-viewing-emails-pr.md
```

## Appendix A: `supabase/functions/_shared/viewingEmails.js`

The module is written in full during Task 1 Step 3. Its shape, fixed here so later tasks match it:

```js
export function fmtDateTime(iso)                       // -> "Saturday, 22 August 2026, 1:15 pm" (Asia/Singapore)
export function mapsUrl(address)                       // -> https://www.google.com/maps/search/?api=1&query=...
export function b64(s)                                 // -> base64, for .ics attachments
export function buildIcs({uid,start,end,summary,description,location,status})
export function tplConfirmation({viewing, captain, cancelUrl})        // -> {subject, html, attachments}
export function tplCaptainNotify({viewing, captainName})              // -> {subject, html}
export function tplAdminNotify({viewing})                             // -> {subject, html}
export function tplReminder24h({viewing, captain, cancelUrl})         // -> {subject, html}
export function tplCancelled({viewing, recipientType, cancelUrl})     // -> {subject, html, attachments?}
export function tplOffHorizonReminder(lead)                           // -> {subject, html}
```

Copy rules that apply to every template, because these emails go to prospects:
- No em-dashes or en-dashes anywhere in copy. The old templates used them freely (`"Quick reminder — your Lazybee viewing is tomorrow"`, `"${captain.name} — ${captain.phone}"`). Rewrite with periods, commas or a middle dot.
- No emoji.
- `generic()` requires both `paragraphs` and `cta`, so every template passes both.
- When `captain.name === "House Captain"` the captain row is omitted rather than printed, and the contact line reads "Self-serve, use the door code above".

## Out of scope, tracked separately

- The off-horizon lead reminder still runs on the Vercel cron and is exposed to the same reachability problem. Zero have fired since 17 Jul. Needs the same treatment.
- No 2h reminder is built. The confirmation copy stops promising it rather than the feature being added. `reminder_2h_sent_at` stays unused.
- Nothing alerts when a queued pg_net request comes back non-200, here or on the TA_READY trigger shipped in PR #101.
- `20260823000000_notify_ta_ready_trigger.sql` hardcodes the anon key. It should read the vault the way this sweep does.
- Abigail's viewing on 29 Aug has the email `abigailzoewu@gmail.co`, missing the `m`. Her confirmation bounced and her reminder will too. Data fix, not code.
