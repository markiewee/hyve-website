# Lazybee Email Redesign + Arrears Ladder Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every transactional email on the Lazybee design system v1.0, add two new templates (portal notice, quiet-prospect nudge), and make the arrears ladder send the five escalating emails it was written for instead of one flat email at every rung.

**Architecture:** The email shell moves out of `notify-tenant/index.ts` into a pure, testable `_shared/emailShell.js` module rendering the alabaster/brass/regal-green tokens from `src/styles/lazybee.css`. The arrears rung selection moves out of `check-late-fees/index.ts` into a pure `_shared/arrearsLadder.js` so the escalation logic can be unit tested without a database. `check-late-fees` then emits the correct per-rung event type rather than `RENT_OVERDUE` five times.

**Tech Stack:** Deno edge functions (Supabase), plain ESM `_shared` modules tested with `node --test`, Resend for delivery.

---

## Context: what is actually broken

Three separate findings, verified against the live database on 18 Aug 2026:

1. **The shell is off-brand.** Emails use teal `#006b5f` on blue-white `#f8f9ff` with system fonts and 16px radii. The site uses alabaster `#F6F2EA`, regal green `#0E2E20`, brass `#B08D4F`, 2px radii, Cormorant/Inter Tight/JetBrains Mono. Two brands, one name.

2. **The ladder escalates fees but not words.** `check-late-fees/index.ts` runs a correct 5-rung ladder (day 3 nudge, day 4 fee warning, day 5 first fee, day 7+ reminders, day 29 final notice + second fee). Every rung calls `notify(..., "RENT_OVERDUE", ...)`. `RENT_OVERDUE` in `notify-tenant/index.ts:394` destructures only `{ month, amount, days_overdue, late_fee }` and **silently drops the `final_notice` and `warning_only` flags the ladder passes it**. A tenant 3 days late and a tenant 29 days late receive an identically-worded email.

3. **Five purpose-built templates sit unused that exactly match those five rungs.** `INVOICE_LATE_NOTICE`, `INVOICE_LATE_FEE_WARNING`, `INVOICE_OVERDUE`, `INVOICE_OVERDUE_REMINDER`, `INVOICE_FINAL_NOTICE` have zero callers anywhere in the repo. They were written for the `invoices` table (3 rows). The business runs on `rent_payments` (104 rows).

The fix for 2 and 3 is one change, not two: map each existing rung to the template already written for it, sourcing data from `rent_payments`.

**Naming note:** the templates keep their `INVOICE_*` event names but are fed from `rent_payments` (`payment_ref` maps to `invoice_code`, `id` maps to `invoice_id`). Renaming them to `RENT_*` is churn for no user-visible gain and is explicitly out of scope.

**Safety decision, needs Mark's sign-off before Task 7:** at day 29 the ladder would begin auto-sending `INVOICE_FINAL_NOTICE`, which reads "we will issue formal notice to vacate and apply the deposit against what is owed." Today that rung sends the mild flat text. Task 7 gates that one rung behind Telegram approval so no eviction-threat email leaves without a human tap. Every rung below 29 continues to auto-send.

---

## File Structure

**Create:**
- `supabase/functions/_shared/emailShell.js` — pure render functions (`generic`, `urgent`, `escape`, `chip`). One responsibility: turn a `LayoutInput` into email-safe HTML on the v1.0 tokens.
- `supabase/functions/_shared/emailShell.test.js` — token and structure assertions.
- `supabase/functions/_shared/arrearsLadder.js` — pure `selectRung(state)` returning which rung fires and what it charges. No IO.
- `supabase/functions/_shared/arrearsLadder.test.js` — one test per rung plus the idempotency and cap cases.

**Modify:**
- `supabase/functions/notify-tenant/index.ts:18-139` — delete the inline shell, import from `_shared/emailShell.js`.
- `supabase/functions/notify-tenant/index.ts:205-690` — add `PORTAL_NOTICE` and `LEAD_STILL_INTERESTED` cases; add `money` to the billing cases.
- `supabase/functions/check-late-fees/index.ts:80-193` — replace the inline if/else ladder with `selectRung`, emit per-rung event types.

---

### Task 1: Extract the arrears ladder into a pure, testable module

**Files:**
- Create: `supabase/functions/_shared/arrearsLadder.js`
- Test: `supabase/functions/_shared/arrearsLadder.test.js`

- [ ] **Step 1: Write the failing test**

```js
// Run with: node --test supabase/functions/_shared/arrearsLadder.test.js
//
// The rung boundaries are the whole point. The live ladder charges a 5% fee at
// day 5 and a second at day 29; getting either boundary wrong either double
// charges a tenant or lets an arrear run free, so every boundary is pinned here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { selectRung } from "./arrearsLadder.js";

const base = {
  daysOverdue: 0,
  lastRemindedAtDays: 0,
  feeCount: 0,
  outstanding: 1300,
  currentFee: 0,
};

test("day 3 fires the friendly nudge and charges nothing", () => {
  const r = selectRung({ ...base, daysOverdue: 3 });
  assert.equal(r.event, "INVOICE_LATE_NOTICE");
  assert.equal(r.newFee, 0);
});

test("day 4 warns that the fee lands tomorrow, still charging nothing", () => {
  const r = selectRung({ ...base, daysOverdue: 4 });
  assert.equal(r.event, "INVOICE_LATE_FEE_WARNING");
  assert.equal(r.newFee, 0);
  assert.equal(r.estimatedLateFee, 65);
});

test("day 5 applies the first 5% fee", () => {
  const r = selectRung({ ...base, daysOverdue: 5 });
  assert.equal(r.event, "INVOICE_OVERDUE");
  assert.equal(r.newFee, 65);
  assert.equal(r.newFeeCount, 1);
});

test("day 7 reminds without charging a second fee", () => {
  const r = selectRung({ ...base, daysOverdue: 7, feeCount: 1, currentFee: 65 });
  assert.equal(r.event, "INVOICE_OVERDUE_REMINDER");
  assert.equal(r.newFee, 0);
});

test("reminders run every other day, so day 8 is silent", () => {
  const r = selectRung({ ...base, daysOverdue: 8, feeCount: 1, currentFee: 65 });
  assert.equal(r.event, null);
});

test("day 29 fires the final notice and the second 5%", () => {
  const r = selectRung({ ...base, daysOverdue: 29, feeCount: 1, currentFee: 65 });
  assert.equal(r.event, "INVOICE_FINAL_NOTICE");
  assert.equal(r.newFee, 65);
  assert.equal(r.newFeeCount, 2);
});

test("the second fee is charged once, not on every day past 29", () => {
  const r = selectRung({ ...base, daysOverdue: 30, feeCount: 2, currentFee: 130, lastRemindedAtDays: 29 });
  assert.equal(r.event, null);
});

test("past the 30 day cap it becomes a conversation, not an email", () => {
  const r = selectRung({ ...base, daysOverdue: 31, feeCount: 2, currentFee: 130 });
  assert.equal(r.event, null);
  assert.equal(r.reason, "past_cap");
});

test("a rung already sent today does not re-send", () => {
  const r = selectRung({ ...base, daysOverdue: 3, lastRemindedAtDays: 3 });
  assert.equal(r.event, null);
});

test("nothing outstanding means nothing chased", () => {
  const r = selectRung({ ...base, daysOverdue: 9, outstanding: 0 });
  assert.equal(r.event, null);
  assert.equal(r.reason, "nothing_outstanding");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test supabase/functions/_shared/arrearsLadder.test.js`
Expected: FAIL, `Cannot find module './arrearsLadder.js'`

- [ ] **Step 3: Write minimal implementation**

```js
/**
 * The arrears ladder, as a pure decision.
 *
 * Lifted verbatim out of check-late-fees so the boundaries can be tested
 * without a database. The rungs and the 5% rate are unchanged from the live
 * ladder; the only thing that changes is that each rung now names its own
 * event type instead of every rung shouting RENT_OVERDUE.
 */

export const LATE_FEE_RATE = 0.05;

/** Automated chasing stops here; past this it is a conversation, not an email. */
export const CAP_DAYS = 30;

export function round2(n) {
  return Math.round(n * 100) / 100;
}

const NONE = (reason) => ({
  event: null,
  reason,
  newFee: 0,
  newFeeCount: null,
  estimatedLateFee: 0,
});

/**
 * @param {object} s
 * @param {number} s.daysOverdue        whole days past due_date, Singapore time
 * @param {number} s.lastRemindedAtDays rent_payments.last_reminder_days_overdue
 * @param {number} s.feeCount           rent_payments.late_fee_count
 * @param {number} s.outstanding        rent + fees already applied, less paid
 * @param {number} s.currentFee         rent_payments.late_fee
 */
export function selectRung(s) {
  const days = Number(s.daysOverdue);
  const last = Number(s.lastRemindedAtDays ?? 0);
  const feeCount = Number(s.feeCount ?? 0);
  const outstanding = Number(s.outstanding ?? 0);

  if (outstanding <= 0) return NONE("nothing_outstanding");
  if (days > CAP_DAYS) return NONE("past_cap");

  const fee = round2(outstanding * LATE_FEE_RATE);

  // 29+ days: final notice, second 5%.
  if (days >= 29 && last < 29) {
    const charge = feeCount < 2 ? fee : 0;
    return {
      event: "INVOICE_FINAL_NOTICE",
      reason: "final_notice",
      newFee: charge,
      newFeeCount: charge > 0 ? feeCount + 1 : feeCount,
      estimatedLateFee: fee,
    };
  }

  // 7+ days, every other day: keep reminding, no further fee.
  if (days >= 7 && (days - 7) % 2 === 0 && last < days) {
    return {
      event: "INVOICE_OVERDUE_REMINDER",
      reason: "reminder",
      newFee: 0,
      newFeeCount: null,
      estimatedLateFee: fee,
    };
  }

  // 5+ days: the first 5% lands.
  if (days >= 5 && feeCount < 1) {
    return {
      event: "INVOICE_OVERDUE",
      reason: "first_fee",
      newFee: fee,
      newFeeCount: 1,
      estimatedLateFee: fee,
    };
  }

  // 4 days: the fee lands tomorrow.
  if (days === 4 && last < 4) {
    return {
      event: "INVOICE_LATE_FEE_WARNING",
      reason: "fee_warning",
      newFee: 0,
      newFeeCount: null,
      estimatedLateFee: fee,
    };
  }

  // 3 days: friendly nudge, no fee.
  if (days === 3 && last < 3) {
    return {
      event: "INVOICE_LATE_NOTICE",
      reason: "nudge",
      newFee: 0,
      newFeeCount: null,
      estimatedLateFee: fee,
    };
  }

  return NONE("no_rung");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test supabase/functions/_shared/arrearsLadder.test.js`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/arrearsLadder.js supabase/functions/_shared/arrearsLadder.test.js
git commit -m "feat: extract arrears ladder into a pure tested module"
```

---

### Task 2: Port the v2.0 email shell into a shared module

**Files:**
- Create: `supabase/functions/_shared/emailShell.js`
- Test: `supabase/functions/_shared/emailShell.test.js`
- Source: copy the reviewed shell from the proof build (`shell.js` in the 18 Aug proof set), converting `module.exports` to ESM `export`.

- [ ] **Step 1: Write the failing test**

```js
// Run with: node --test supabase/functions/_shared/emailShell.test.js
//
// These assert the two things that actually break silently in email: a token
// drifting away from src/styles/lazybee.css, and a font stack losing its
// fallback (Gmail strips the Google Fonts link, so a bare family name renders
// as Times and nobody notices until a tenant sees it).

import { test } from "node:test";
import assert from "node:assert/strict";
import { generic, urgent, escape, chip } from "./emailShell.js";

const input = {
  badge: "Rent due",
  headline: "Your rent for September.",
  greeting: "Hi Edward,",
  paragraphs: ["<strong>SGD 1,300.00</strong> is due by 1 Sep 2026."],
  money: { label: "Amount due", value: "SGD 1,300.00", footnote: "Due 1 Sep 2026" },
  details: [{ label: "Payment ref", value: chip("LZB-0417-EDW") }],
  cta: { label: "View Billing", url: "https://www.lazybee.sg/portal/billing" },
};

test("carries the design system v1.0 tokens, not the old teal scheme", () => {
  const html = generic(input);
  assert.ok(html.includes("#F6F2EA"), "alabaster ground");
  assert.ok(html.includes("#0E2E20"), "regal green band");
  assert.ok(html.includes("#B08D4F"), "brass rule");
  assert.ok(!html.includes("#006b5f"), "old teal must be gone");
  assert.ok(!html.includes("#f8f9ff"), "old blue-white must be gone");
});

test("every font stack keeps a real fallback for Gmail", () => {
  const html = generic(input);
  assert.ok(html.includes("'Cormorant Garamond',Georgia"), "serif fallback");
  assert.ok(html.includes("'Inter Tight',-apple-system"), "sans fallback");
  assert.ok(html.includes("'JetBrains Mono',ui-monospace"), "mono fallback");
});

test("the urgent variant repaints the band and the eyebrow, not the whole page", () => {
  const html = urgent(input);
  assert.ok(html.includes("#8C3A2B"), "bad token present");
  assert.ok(html.includes("#F6F2EA"), "ground stays alabaster");
});

test("the money band renders the value verbatim", () => {
  assert.ok(generic(input).includes("SGD 1,300.00"));
});

test("omitting money omits the band entirely", () => {
  const { money, ...noMoney } = input;
  assert.ok(!generic(noMoney).includes("#0E2E20;border-radius:2px"));
});

test("escape neutralises injected markup", () => {
  assert.equal(escape("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;");
});

test("renders under Gmail's 102kb clipping threshold", () => {
  assert.ok(Buffer.byteLength(generic(input)) < 102 * 1024);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test supabase/functions/_shared/emailShell.test.js`
Expected: FAIL, `Cannot find module './emailShell.js'`

- [ ] **Step 3: Copy the reviewed shell into place**

Copy the proof-set `shell.js` verbatim, with two changes:
1. Replace the trailing `module.exports = {...}` with `export { generic, urgent, escape, chip, PORTAL_BASE, T, F };`
2. Change each `function`/`const` that is exported to carry `export` inline, matching the ESM style of `rentMath.js`.

No other edits. The shell was reviewed and approved on 18 Aug; changing it here would ship something Mark did not see.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test supabase/functions/_shared/emailShell.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/emailShell.js supabase/functions/_shared/emailShell.test.js
git commit -m "feat: add v2.0 email shell on Lazybee design system v1.0"
```

---

### Task 3: Swap notify-tenant onto the new shell

**Files:**
- Modify: `supabase/functions/notify-tenant/index.ts:18-139` (delete inline shell), `:1-16` (add import)

- [ ] **Step 1: Delete the inline shell and import the shared one**

Delete lines 18 through 139 inclusive (the `Email layout helpers` block through `const urgent = ...`). Replace with:

```ts
import { generic, urgent, escape, chip } from "../_shared/emailShell.js";
```

Keep `PORTAL_BASE` defined locally at line 13. Delete the now-unused `LOGO_URL`, `HERO_GENERIC` and `HERO_URGENT` constants at lines 14 to 16: the v2.0 shell uses a live-text wordmark and no hero image, so those three public assets are no longer referenced.

- [ ] **Step 2: Verify the function still type-checks**

Run: `deno check supabase/functions/notify-tenant/index.ts`
Expected: no errors. If `Detail` is reported missing, re-export it from `emailShell.js`.

- [ ] **Step 3: Add money bands to the billing cases**

For each of `RENT_DUE`, `RENT_OVERDUE`, `RENT_PAID`, `INVOICE_ISSUED`, `INVOICE_UPDATED`, `INVOICE_PAID`, `INVOICE_OVERDUE`, `INVOICE_LATE_NOTICE`, `INVOICE_LATE_FEE_WARNING`, `INVOICE_OVERDUE_REMINDER`, `INVOICE_FINAL_NOTICE`, add a `money` key matching the approved proofs. `RENT_DUE` becomes:

```ts
    case "RENT_DUE": {
      const { month: dueMonth, amount: dueAmount, due_date, payment_ref, prorated_note } = details;
      return {
        subject: `Rent for ${dueMonth}, SGD ${escape(String(dueAmount))} due`,
        html: generic({
          badge: "Rent due",
          headline: `Your rent for ${escape(String(dueMonth))}.`,
          greeting: `Hi ${firstName},`,
          paragraphs: [
            prorated_note ? escape(String(prorated_note)) : "",
            payment_ref
              ? `Please put the reference below in the transfer field. That code is how the payment is matched to you automatically, and without it we have to chase you to confirm it arrived.`
              : "",
          ].filter(Boolean),
          money: {
            label: "Amount due",
            value: `SGD ${escape(String(dueAmount))}`,
            footnote: `Due ${escape(String(due_date))}`,
          },
          details: payment_ref ? [{ label: "Payment ref", value: chip(String(payment_ref)) }] : [],
          cta: { label: "View Billing", url: `${PORTAL_BASE}/portal/billing` },
          ctaCaption: payment_ref ? `Reference: ${payment_ref}` : undefined,
        }),
      };
    }
```

- [ ] **Step 4: Strip the em-dashes from every remaining subject line**

Run: `grep -n "[—–]" supabase/functions/notify-tenant/index.ts`
Expected after edits: no output. Replace each with a comma, colon, or the word it stands in for. Standing rule from Mark, applies to outbound copy too.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-tenant/index.ts
git commit -m "refactor: move notify-tenant onto shared v2.0 email shell"
```

---

### Task 4: Add the PORTAL_NOTICE event type

**Files:**
- Modify: `supabase/functions/notify-tenant/index.ts` (add case before `default:`)

- [ ] **Step 1: Add the case**

Copy the `PORTAL_NOTICE_KINDS` map and `PORTAL_NOTICE` builder verbatim from the approved proof set `templates.js`, converting to a `case` inside the existing switch. Four kinds: `MESSAGE`, `MAINTENANCE`, `NOTICE`, `DOCUMENT`. The body deliberately carries a preview, never the full text, so the click has to land in the portal.

- [ ] **Step 2: Verify it builds**

Run: `deno check supabase/functions/notify-tenant/index.ts`
Expected: no errors.

- [ ] **Step 3: Send yourself one of each kind**

Run, once per kind, against the deployed function:

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/notify-tenant" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"event_type":"PORTAL_NOTICE","tenant_profile_id":"<a test profile id>",
       "details":{"kind":"MESSAGE","from_name":"Kavi","from_role":"Lazybee ops",
       "subject":"Test","preview":"Test preview","posted_at":"18 Aug 2026","thread_id":"th_1"}}'
```

Expected: HTTP 200, email arrives, the CTA opens `/portal/messages/th_1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notify-tenant/index.ts
git commit -m "feat: add PORTAL_NOTICE email for portal messages and notices"
```

---

### Task 5: Add the LEAD_STILL_INTERESTED event type

**Files:**
- Modify: `supabase/functions/notify-tenant/index.ts`

- [ ] **Step 1: Add the case**

Copy the `LEAD_STILL_INTERESTED` builder verbatim from the approved proof set. It takes a lead, not a tenant, so it must not go through `getTenantContext`. Add an early branch in the handler: when `event_type === "LEAD_STILL_INTERESTED"`, read `details.email` and `details.first_name` directly from the payload and skip the tenant lookup entirely.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/notify-tenant/index.ts
git commit -m "feat: add LEAD_STILL_INTERESTED nudge for quiet prospects"
```

**Note:** the opt-out link this email carries requires Task 5a, which must ship in the same PR. Shipping a "stop emailing me" link that 404s is worse than not offering one.

---

### Task 5a: Build the lead opt-out route

**Files:**
- Create: `api/leads/close.js`
- Test: `src/lib/leadCloseToken.test.js`
- Create: `src/lib/leadCloseToken.js`

**Why:** verified on 18 Aug 2026, `/leads/close` does not exist and neither does any other opt-out route. The `leads` table already has the destination state (`closed_lost`, 207 rows), so this is a missing door, not a missing concept.

- [ ] **Step 1: Write the failing token test**

```js
// Run with: node --test src/lib/leadCloseToken.test.js
//
// The token is the only thing standing between a public URL and anyone being
// able to close any lead by guessing an id, so it is signed, not a raw uuid.

import { test } from "node:test";
import assert from "node:assert/strict";
import { signLeadToken, verifyLeadToken } from "./leadCloseToken.js";

const SECRET = "test-secret";

test("a signed token round-trips to its lead id", () => {
  const t = signLeadToken("lead-123", SECRET);
  assert.equal(verifyLeadToken(t, SECRET), "lead-123");
});

test("a tampered token is rejected", () => {
  const t = signLeadToken("lead-123", SECRET);
  assert.equal(verifyLeadToken(t.slice(0, -2) + "xx", SECRET), null);
});

test("a token signed with another secret is rejected", () => {
  assert.equal(verifyLeadToken(signLeadToken("lead-123", "other"), SECRET), null);
});

test("a bare lead id is not accepted as a token", () => {
  assert.equal(verifyLeadToken("lead-123", SECRET), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/leadCloseToken.test.js`
Expected: FAIL, `Cannot find module './leadCloseToken.js'`

- [ ] **Step 3: Implement the token helper**

```js
import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sig(leadId, secret) {
  return b64url(createHmac("sha256", secret).update(leadId).digest()).slice(0, 22);
}

export function signLeadToken(leadId, secret) {
  return `${b64url(leadId)}.${sig(leadId, secret)}`;
}

export function verifyLeadToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  let leadId;
  try {
    leadId = Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
  const expected = Buffer.from(sig(leadId, secret));
  const given = Buffer.from(parts[1]);
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? leadId : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/leadCloseToken.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Build the route**

```js
// api/leads/close.js
import { createClient } from "@supabase/supabase-js";
import { verifyLeadToken } from "../../src/lib/leadCloseToken.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const page = (title, body) => `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="margin:0;background:#F6F2EA;color:#241C16;font-family:'Inter Tight',system-ui,sans-serif;
  display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px">
<div><p style="font-family:Georgia,serif;font-size:30px;font-weight:300;margin:0 0 12px">${title}</p>
<p style="color:#5C5247;font-size:16px;line-height:1.7;max-width:44ch;margin:0">${body}</p></div>`;

export default async function handler(req, res) {
  const leadId = verifyLeadToken(req.query.t, process.env.LEAD_TOKEN_SECRET);
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!leadId) {
    return res.status(400).send(page("That link has expired.", "Drop us a line at hello@lazybee.sg and we'll take you off the list."));
  }

  const { error } = await supabase
    .from("leads")
    .update({ status: "closed_lost", notes: "Closed by tenant via email opt-out" })
    .eq("id", leadId);

  if (error) {
    return res.status(500).send(page("Something went wrong.", "Email hello@lazybee.sg and we'll sort it out."));
  }
  return res.status(200).send(page("Done, you're off the list.", "We won't email you about this room again. All the best with the search."));
}
```

- [ ] **Step 6: Set the signing secret**

```bash
vercel env add LEAD_TOKEN_SECRET production
```

Use the same value when generating tokens in the nudge sender, or every link will fail verification.

- [ ] **Step 7: Verify end to end**

Sign a token for a real `cold` lead, open the URL, then confirm:

```sql
select id, status, notes from public.leads where id = '<lead id>';
```

Expected: `closed_lost`, note recorded, page reads "Done, you're off the list."

- [ ] **Step 8: Commit**

```bash
git add api/leads/close.js src/lib/leadCloseToken.js src/lib/leadCloseToken.test.js
git commit -m "feat: add signed lead opt-out route for the still-interested nudge"
```

---

### Task 6: Point the ladder at the right template per rung

**Files:**
- Modify: `supabase/functions/check-late-fees/index.ts:80-193`

- [ ] **Step 1: Import the shared ladder and delete the inline if/else**

```ts
import { selectRung, round2, CAP_DAYS } from "../_shared/arrearsLadder.js";
```

Delete the inline rung chain (the five `if`/`else if` blocks) and the local `round2` and `CAP_DAYS`.

- [ ] **Step 2: Replace the per-row body**

```ts
      const rung = selectRung({
        daysOverdue,
        lastRemindedAtDays: Number(rp.last_reminder_days_overdue ?? 0),
        feeCount: Number(rp.late_fee_count ?? 0),
        outstanding,
        currentFee,
      });

      if (!rung.event) {
        results.push(`${rp.payment_ref}: ${rung.reason}`);
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (rung.newFee > 0) {
        patch.late_fee = round2(currentFee + rung.newFee);
        patch.late_fee_count = rung.newFeeCount;
        patch.late_fee_applied_at = now.toISOString();
      }

      await notify(rp.tenant_profile_id, rung.event, {
        invoice_code: rp.payment_ref,
        invoice_id: rp.id,
        month_label: monthLabel(rp.month),
        amount: round2(outstanding + rung.newFee).toFixed(2),
        days_overdue: daysOverdue,
        late_fee: rung.newFee.toFixed(2),
        estimated_late_fee: rung.estimatedLateFee.toFixed(2),
      });
      results.push(`${rp.payment_ref}: ${rung.event} (${daysOverdue} days)`);

      patch.last_reminder_at = now.toISOString();
      patch.last_reminder_days_overdue = daysOverdue;
      patch.is_late = true;
      if (rp.status === "PENDING") patch.status = "OVERDUE";
```

Keep the existing update block and the `late_fee_waived` skip untouched.

- [ ] **Step 3: Dry-run against production data without sending**

Add a temporary `?dry=1` guard that skips the `notify` call and returns the `results` array only. Deploy to a preview, invoke it, and read the output.

Run: `curl -s "$SUPABASE_URL/functions/v1/check-late-fees?dry=1" -H "Authorization: Bearer $SERVICE_KEY"`
Expected: one line per overdue row naming the event type it would send. **Verify no row shows `INVOICE_FINAL_NOTICE` unexpectedly** before removing the guard. Remove the guard before merging.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/check-late-fees/index.ts
git commit -m "fix: send the right arrears email per rung instead of one flat notice"
```

---

### Task 7: Gate the final notice behind human approval

**Files:**
- Modify: `supabase/functions/check-late-fees/index.ts`

**Why:** `INVOICE_FINAL_NOTICE` states we will issue notice to vacate and forfeit the deposit. That is a legal posture, not a chase. Mark's standing rule sends chases straight out but drafts complaints and money decisions for review first; an eviction threat sits on the review side of that line.

- [ ] **Step 1: Divert the final-notice rung to Telegram instead of the tenant**

```ts
      if (rung.event === "INVOICE_FINAL_NOTICE") {
        // Fees still apply on schedule; only the email waits for a human.
        await notifyMark(
          `Final notice ready: ${rp.payment_ref}, ${daysOverdue} days, ` +
          `SGD ${round2(outstanding + rung.newFee).toFixed(2)} outstanding.\n` +
          `Approve to send: ${PORTAL_BASE}/portal/admin/arrears/${rp.id}`
        );
        results.push(`${rp.payment_ref}: FINAL NOTICE queued for Mark`);
      } else {
        await notify(rp.tenant_profile_id, rung.event, { /* payload from Task 6 */ });
        results.push(`${rp.payment_ref}: ${rung.event} (${daysOverdue} days)`);
      }
```

- [ ] **Step 2: Verify no tenant email is sent on that path**

Run the dry-run from Task 6 Step 3 against a seeded row at 29 days.
Expected: the results line reads `queued for Mark`, and no Resend call appears in the function logs.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/check-late-fees/index.ts
git commit -m "feat: hold final notices for human approval before sending"
```

---

### Task 8: Fire INVOICE_ISSUED and INVOICE_UPDATED

**Files:**
- Modify: `src/hooks/useAdminInvoices.js:62` area (add issue notification alongside the existing paid one)

- [ ] **Step 1: Notify on invoice creation**

`useAdminInvoices.js` already calls `notifyMember(..., "INVOICE_PAID", ...)`. Add the mirror call wherever an invoice row is created:

```js
      notifyMember(invoice.tenant_profile_id, "INVOICE_ISSUED", {
        invoice_code: invoice.invoice_code,
        invoice_id: invoice.id,
        amount: Number(invoice.total_amount).toFixed(2),
        due_date: invoice.due_date,
      });
```

- [ ] **Step 2: Notify when usage charges land**

`INVOICE_UPDATED` fires only when a line item is appended after issue. Add the same shape to the AC-usage append path, passing the new total.

- [ ] **Step 3: Verify against a test invoice**

Create an invoice for a test profile in the admin UI. Expected: one `INVOICE_ISSUED` email with the correct code and total. Append an AC charge. Expected: one `INVOICE_UPDATED` email showing the new total.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAdminInvoices.js
git commit -m "feat: email tenants when an invoice is issued or updated"
```

---

### Task 9: Deploy and verify live

- [ ] **Step 1: Deploy both edge functions**

```bash
npx supabase functions deploy notify-tenant --project-ref diiilqpfmlxjwiaeophb
npx supabase functions deploy check-late-fees --project-ref diiilqpfmlxjwiaeophb
```

- [ ] **Step 2: Send one live proof of each new template to mark@lazybee.sg**

Expected: both arrive, render on the alabaster ground, CTAs resolve.

- [ ] **Step 3: Watch the first scheduled ladder run**

Read the function logs the morning after deploy.
Expected: every line names a specific event type. No line reads `RENT_OVERDUE`. Any `INVOICE_FINAL_NOTICE` line reads `queued for Mark`.

- [ ] **Step 4: Confirm nothing double-sent**

```sql
select payment_ref, last_reminder_days_overdue, late_fee_count, late_fee
from rent_payments
where month >= '2026-08-01' and is_late = true
order by last_reminder_at desc;
```

Expected: `late_fee_count` never exceeds 2; `last_reminder_days_overdue` advances monotonically per row.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "chore: deploy email redesign and arrears ladder wiring"
gh pr create --title "Email redesign on design system v1.0 + arrears ladder wiring" --body "See docs/superpowers/plans/2026-08-18-email-redesign-and-arrears-ladder.md"
```

---

## Rollback

The shell swap is pure presentation and reverts with one commit. The ladder change is behavioural: if a rung misfires, revert Task 6 alone and the ladder returns to sending flat `RENT_OVERDUE` at every rung, which is the current live behaviour. `rent_payments.late_fee_count` guards against double-charging across a revert, so no tenant is charged twice by rolling back.
