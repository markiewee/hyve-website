# Reserve Onboarding Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `api/portal/claim-reserve.js` from stamping the wrong move-in date, skipping the whole registration sequence, and minting a duplicate tenant profile when a prospect reserves the same room twice.

**Architecture:** Extract the three seeding decisions (profile payload, onboarding payload, duplicate reuse) out of the endpoint into a pure module `src/lib/reserveOnboarding.js`, which is unit-tested with `node:test` exactly like the other `src/lib/*.test.js` modules. The endpoint keeps all Supabase I/O and simply calls the pure builders. No schema change is required: `tenant_profiles.moved_in_at` already accepts an explicit value, we just never sent one.

**Tech Stack:** Node 20 ESM, `node:test` + `node:assert/strict`, `@supabase/supabase-js`, Vercel serverless functions.

---

## Background: the three defects, as proven against production

All three were confirmed against the live `hyve-iot` project (`diiilqpfmlxjwiaeophb`) on 13 Aug 2026 using the Julia Rönkkö reservation as the reproducing case.

**Defect 1: move-in date is the submission timestamp.**
`tenant_profiles.moved_in_at` is `NOT NULL DEFAULT now()`. The insert in `claim-reserve.js` step 4 never sets it, so the column defaults to the moment the form was submitted. Julia's real tenancy starts 8 Sep 2026; her profile read `moved_in_at = 2026-08-12`. The correct value was sitting on the same row we already read: `soft_reserves.preferred_move_in = 2026-09-08`. It was passed only into `onboarding_progress.tenancy_start_date` and never onto the profile. Consequence: the room reads as occupied from the submission date, so availability, the vacancy pipeline, and the sell-priority report are all wrong.

**Defect 2: the whole registration sequence is skipped.**
The onboarding insert hardcodes `current_step: "DEPOSIT"`. `REGISTRATION_STEPS` in `src/hooks/useOnboarding.js` is `["WELCOME", "PERSONAL_DETAILS", "ID_VERIFICATION", "SIGN_TA"]`, all four of which are jumped. Consequence: the tenant is asked for money before they have given personal details, uploaded ID, or signed a licence agreement. This is the mechanism behind the standing "20 of 29 active tenancies have no signed agreement" finding.

**Defect 3: a second reserve mints a second profile.**
Idempotency is keyed on `sr.tenant_profile_id`, which is per-`soft_reserves`-row. The only cross-reserve guard is the `wonRows` check, which fires only on `status = 'won'`. Julia submitted twice (reserves `a4994b34` on 11 Aug and `867cf3cf` on 12 Aug), both for room `5d1dca93`, both under `julia.ronkko02@gmail.com`, and both sat at `account_created`, so nothing blocked the second. Result: two `is_active` tenant profiles and two `onboarding_progress` rows on one room for one person.

**Also missing:** `lease_end` and `lease_months` are never written to the profile even though `soft_reserves.duration_months` is known at insert time.

**Date convention:** established in `src/pages/portal/AdminOnboardingPage.jsx:100` and `AdminOnboardingDetailPage.jsx:128` as `start + N months, then minus one day` (the in-repo comment reads "e.g. 1 Apr + 6 months = 30 Sep"). The new helper must match this exactly so the API and the admin UI never disagree.

---

## File Structure

- **Create** `src/lib/reserveOnboarding.js` — pure seeding logic. No imports, no I/O. One responsibility: given a reserve plus a room, decide what the two insert payloads should contain and whether an existing profile should be reused.
- **Create** `src/lib/reserveOnboarding.test.js` — `node:test` unit tests covering every defect above with the real production values.
- **Modify** `api/portal/claim-reserve.js` — step 4 only. Replace the inline payload literals with calls into the new module, and add the sibling-reserve lookup that feeds the reuse decision.

Everything else in the endpoint (auth user creation, Stripe customer, `soft_reserves` advance) is untouched.

---

### Task 1: Pure seeding module

**Files:**
- Create: `src/lib/reserveOnboarding.js`
- Test: `src/lib/reserveOnboarding.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reserveOnboarding.test.js`:

```js
// src/lib/reserveOnboarding.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  RESERVE_FIRST_STEP,
  addMonthsMinusADay,
  pickReusableProfileId,
  buildProfileSeed,
  buildOnboardingSeed,
} from "./reserveOnboarding.js";

// The convention the admin UI already uses: start + N months, minus one day.
// AdminOnboardingPage.jsx says "1 Apr + 6 months = 30 Sep" in its own comment.
test("a lease ends the day before the anniversary, not on it", () => {
  assert.equal(addMonthsMinusADay("2026-04-01", 6), "2026-09-30");
  assert.equal(addMonthsMinusADay("2026-09-08", 3), "2026-12-07");
  assert.equal(addMonthsMinusADay("2026-01-15", 12), "2027-01-14");
});

test("a missing or nonsense duration yields no end date rather than a wrong one", () => {
  assert.equal(addMonthsMinusADay("2026-09-08", null), null);
  assert.equal(addMonthsMinusADay("2026-09-08", 0), null);
  assert.equal(addMonthsMinusADay(null, 3), null);
  assert.equal(addMonthsMinusADay("not-a-date", 3), null);
});

// Documents JS setMonth overflow deliberately. The admin UI has the identical
// behaviour, so matching it keeps the API and the screen in agreement. Diverging
// here would be a new bug, not a fix.
test("month-end overflow matches the admin UI instead of quietly differing", () => {
  assert.equal(addMonthsMinusADay("2026-01-31", 1), "2026-03-02");
});

// Defect 1: the real move-in was on the reserve the whole time.
test("the profile carries the tenancy start, never the submission time", () => {
  const seed = buildProfileSeed({
    reserve: { room_id: "room-1", property_id: "prop-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: 1500, deposit_months: 1 },
  });
  assert.equal(seed.moved_in_at, "2026-09-08");
  assert.equal(seed.lease_end, "2026-12-07");
  assert.equal(seed.lease_months, 3);
  assert.equal(seed.monthly_rent, 1500);
  assert.equal(seed.room_id, "room-1");
  assert.equal(seed.property_id, "prop-1");
  assert.equal(seed.role, "TENANT");
  assert.equal(seed.is_active, true);
});

test("with no stated move-in we omit the field and let the column default stand", () => {
  const seed = buildProfileSeed({
    reserve: { room_id: "room-1", property_id: "prop-1", preferred_move_in: null, duration_months: null },
    room: { price_monthly: 1500, deposit_months: 1 },
  });
  assert.equal("moved_in_at" in seed, false);
  assert.equal("lease_end" in seed, false);
  assert.equal("lease_months" in seed, false);
});

// Defect 2: registration must not be skipped.
test("onboarding starts at the first registration step, not at the money", () => {
  const seed = buildOnboardingSeed({
    tenantProfileId: "tp-1",
    reserve: { room_id: "room-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: 1500, deposit_months: 1 },
  });
  assert.equal(seed.current_step, RESERVE_FIRST_STEP);
  assert.notEqual(seed.current_step, "DEPOSIT");
  assert.equal(seed.status, "ONBOARDING");
  assert.equal(seed.tenant_profile_id, "tp-1");
  assert.equal(seed.tenancy_start_date, "2026-09-08");
  assert.equal(seed.tenancy_end_date, "2026-12-07");
  assert.equal(seed.deposit_amount, 1500);
});

test("deposit amount is months times rent, and absent when the room cannot price it", () => {
  const priced = buildOnboardingSeed({
    tenantProfileId: "tp-1",
    reserve: { room_id: "room-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: 1200, deposit_months: 2 },
  });
  assert.equal(priced.deposit_amount, 2400);

  const unpriced = buildOnboardingSeed({
    tenantProfileId: "tp-1",
    reserve: { room_id: "room-1", preferred_move_in: "2026-09-08", duration_months: 3 },
    room: { price_monthly: null, deposit_months: null },
  });
  assert.equal("deposit_amount" in unpriced, false);
});

// Defect 3: Julia's exact production shape. Two reserves, one room, one person.
test("a second reserve for the same room reuses the first profile", () => {
  const siblings = [
    { id: "a4994b34", status: "account_created", tenant_profile_id: "7785384a", created_at: "2026-08-11T07:22:49Z" },
  ];
  assert.equal(pickReusableProfileId(siblings), "7785384a");
});

test("the oldest usable profile wins so we converge rather than ping-pong", () => {
  const siblings = [
    { id: "newer", status: "account_created", tenant_profile_id: "profile-new", created_at: "2026-08-12T19:45:58Z" },
    { id: "older", status: "reserved", tenant_profile_id: "profile-old", created_at: "2026-08-11T07:22:49Z" },
  ];
  assert.equal(pickReusableProfileId(siblings), "profile-old");
});

test("dead reserves and empty ones never donate a profile", () => {
  assert.equal(pickReusableProfileId([]), null);
  assert.equal(pickReusableProfileId(null), null);
  assert.equal(pickReusableProfileId([
    { id: "x", status: "lost", tenant_profile_id: "profile-lost", created_at: "2026-08-01T00:00:00Z" },
    { id: "y", status: "expired", tenant_profile_id: "profile-exp", created_at: "2026-08-02T00:00:00Z" },
    { id: "z", status: "reserved", tenant_profile_id: null, created_at: "2026-08-03T00:00:00Z" },
  ]), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-website && node --test src/lib/reserveOnboarding.test.js`
Expected: FAIL with `Cannot find module '.../src/lib/reserveOnboarding.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/reserveOnboarding.js`:

```js
// src/lib/reserveOnboarding.js
//
// Pure seeding decisions for a reserve that is being claimed. No I/O: the
// endpoint owns every Supabase call and just asks this module what to write.
//
// Exists because api/portal/claim-reserve.js used to inline three wrong
// answers: it let moved_in_at fall through to now(), it hardcoded the first
// onboarding step to DEPOSIT, and it keyed idempotency on a single reserve row
// so a second reserve for the same room minted a second tenant profile.

/** First step a claimed reserve lands on. Registration comes before money. */
export const RESERVE_FIRST_STEP = "PERSONAL_DETAILS";

/** A reserve in one of these states must never donate its profile. */
const DEAD_RESERVE_STATES = new Set(["lost", "expired"]);

/**
 * start + months, minus one day.
 *
 * Matches AdminOnboardingPage.jsx and AdminOnboardingDetailPage.jsx exactly,
 * including JS setMonth day-overflow (31 Jan + 1 month lands in March), so the
 * API and the admin screen can never disagree about the same tenancy. Computed
 * in UTC so the result does not shift with the server's timezone.
 *
 * @returns {string|null} "YYYY-MM-DD", or null if it cannot be computed.
 */
export function addMonthsMinusADay(startDate, months) {
  const n = Number(months);
  if (!startDate || !Number.isFinite(n) || n <= 0) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate));
  if (!m) return null;

  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dt.getTime())) return null;

  dt.setUTCMonth(dt.getUTCMonth() + n);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Given every other soft_reserve for the same room and prospect, return the
 * tenant_profile_id we should reuse instead of minting a new one.
 *
 * Oldest first: the first profile a person got is the one their documents,
 * onboarding progress and Stripe customer already hang off.
 *
 * @returns {string|null}
 */
export function pickReusableProfileId(siblingReserves) {
  if (!Array.isArray(siblingReserves)) return null;

  const usable = siblingReserves
    .filter((r) => r && r.tenant_profile_id && !DEAD_RESERVE_STATES.has(r.status))
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

  return usable.length > 0 ? usable[0].tenant_profile_id : null;
}

function depositAmount(room) {
  if (!room || room.deposit_months == null || room.price_monthly == null) return null;
  const amount = Number(room.deposit_months) * Number(room.price_monthly);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * The tenant_profiles insert payload.
 *
 * moved_in_at is set explicitly from the reserve's preferred move-in. The column
 * is NOT NULL DEFAULT now(), so omitting it silently records the submission
 * timestamp as the tenancy start. When we genuinely have no date we omit the
 * key and accept the default rather than invent one.
 */
export function buildProfileSeed({ reserve, room }) {
  const r = reserve || {};
  const monthly = room && room.price_monthly != null ? Number(room.price_monthly) : null;

  const seed = {
    room_id: r.room_id,
    property_id: r.property_id,
    role: "TENANT",
    is_active: true,
    monthly_rent: Number.isFinite(monthly) ? monthly : null,
  };

  const moveIn = r.preferred_move_in || null;
  if (moveIn) {
    seed.moved_in_at = moveIn;

    const months = Number(r.duration_months);
    const end = addMonthsMinusADay(moveIn, months);
    if (end) {
      seed.lease_end = end;
      seed.lease_months = months;
    }
  }

  return seed;
}

/**
 * The onboarding_progress insert payload.
 *
 * current_step starts at RESERVE_FIRST_STEP. It used to be hardcoded to
 * DEPOSIT, which asked people for money before they had given their details,
 * uploaded ID, or signed anything.
 */
export function buildOnboardingSeed({ tenantProfileId, reserve, room }) {
  const r = reserve || {};

  const seed = {
    tenant_profile_id: tenantProfileId,
    room_id: r.room_id,
    current_step: RESERVE_FIRST_STEP,
    status: "ONBOARDING",
  };

  const deposit = depositAmount(room);
  if (deposit != null) seed.deposit_amount = deposit;

  const moveIn = r.preferred_move_in || null;
  if (moveIn) {
    seed.tenancy_start_date = moveIn;
    const end = addMonthsMinusADay(moveIn, Number(r.duration_months));
    if (end) seed.tenancy_end_date = end;
  }

  return seed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-website && node --test src/lib/reserveOnboarding.test.js`
Expected: PASS, `pass 10`, `fail 0`

- [ ] **Step 5: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add src/lib/reserveOnboarding.js src/lib/reserveOnboarding.test.js
git commit -m "feat: pure reserve onboarding seeding with correct dates and first step"
```

---

### Task 2: Wire the endpoint to the pure module

**Files:**
- Modify: `api/portal/claim-reserve.js` (import block, and step 4 of the POST handler)

- [ ] **Step 1: Add the import**

At the top of `api/portal/claim-reserve.js`, directly under the existing `import Stripe from "stripe";` line, add:

```js
import {
  pickReusableProfileId,
  buildProfileSeed,
  buildOnboardingSeed,
} from "../../src/lib/reserveOnboarding.js";
```

- [ ] **Step 2: Replace step 4 of the POST handler**

Find the block that begins with the comment `// 4. tenant_profile — idempotent.` and ends immediately before the comment `// 5. Auth user — idempotent.`. Replace that entire block with:

```js
  // 4. tenant_profile — idempotent across every reserve for this room+person.
  //
  // Keying only on sr.tenant_profile_id was per-row, so a prospect who filled
  // the reserve form twice got two active profiles on one room. Look across
  // their sibling reserves first and adopt the profile they already have.
  let tenantProfileId = sr.tenant_profile_id || null;

  if (!tenantProfileId && sr.prospect_email) {
    const { data: siblings, error: sibErr } = await supabase
      .from("soft_reserves")
      .select("id, status, tenant_profile_id, created_at")
      .eq("room_id", sr.room_id)
      .eq("prospect_email", sr.prospect_email)
      .neq("id", sr.id);

    if (sibErr) {
      console.error("[claim-reserve] sibling reserve lookup failed:", sibErr);
    } else {
      tenantProfileId = pickReusableProfileId(siblings);
      if (tenantProfileId) {
        console.log(
          "[claim-reserve] reusing existing tenant_profile",
          tenantProfileId,
          "for repeat reserve",
          sr.id
        );
      }
    }
  }

  if (!tenantProfileId) {
    const { data: profile, error: profErr } = await supabase
      .from("tenant_profiles")
      .insert(buildProfileSeed({ reserve: sr, room }))
      .select("id")
      .single();

    if (profErr) {
      console.error("[claim-reserve] tenant_profiles insert failed:", profErr);
      return res.status(500).json({ error: "Could not create tenant profile" });
    }

    tenantProfileId = profile.id;

    const { error: obErr } = await supabase
      .from("onboarding_progress")
      .insert(buildOnboardingSeed({ tenantProfileId, reserve: sr, room }));
    if (obErr) {
      console.error("[claim-reserve] onboarding_progress insert failed:", obErr);
    }
  }
```

Note: `buildProfileSeed` reads `preferred_move_in` and `duration_months` off the reserve row. The POST body may carry fresher values in `move_in` / `duration_months`, so step 3 below merges them before this block runs.

- [ ] **Step 3: Merge the fresher body values onto the reserve before seeding**

The old code preferred `move_in` from the request body over `sr.preferred_move_in`. Preserve that. Immediately after the `if (!sr) return res.status(404).json({ error: "reserve_not_found" });` line near the top of the POST flow, the reserve is already loaded, but the body values are destructured further down. So instead, insert this directly *above* the `// 4. tenant_profile` comment block:

```js
  // The form may carry fresher dates than the stored reserve. Seeding reads
  // from the reserve, so fold the body values on first.
  const seedReserve = {
    ...sr,
    preferred_move_in: move_in || sr.preferred_move_in,
    duration_months: duration_months ?? sr.duration_months,
  };
```

Then in the two `build*` calls from Step 2, pass `reserve: seedReserve` instead of `reserve: sr`.

- [ ] **Step 4: Verify the endpoint still parses and the unit tests pass**

Run:
```bash
cd /Users/mark/Desktop/hyve-website
node --check api/portal/claim-reserve.js
node --test src/lib/reserveOnboarding.test.js
npm run lint 2>&1 | tail -20
```
Expected: `node --check` silent (exit 0), tests `pass 10 fail 0`, lint reporting no new errors in the two touched files.

- [ ] **Step 5: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add api/portal/claim-reserve.js
git commit -m "fix: reserve claim keeps real move-in date, starts at registration, reuses profile on repeat"
```

---

### Task 3: Backfill audit query

**Files:**
- Create: `docs/superpowers/plans/2026-08-13-reserve-backfill.sql`

Julia was repaired by hand on 13 Aug. Other tenancies created through this endpoint carry the same wrong `moved_in_at` and skipped steps. This task produces the list; it does not mutate anything, because deciding what to correct is Mark's call.

- [ ] **Step 1: Write the audit query**

Create `docs/superpowers/plans/2026-08-13-reserve-backfill.sql`:

```sql
-- Every profile the reserve flow seeded where the recorded move-in disagrees
-- with what the prospect actually asked for. Read-only: produces the worklist.
select
  tp.id              as tenant_profile_id,
  r.unit_code,
  sr.prospect_name,
  sr.prospect_email,
  tp.moved_in_at::date  as recorded_move_in,
  sr.preferred_move_in  as requested_move_in,
  sr.duration_months,
  tp.lease_end,
  o.current_step,
  o.personal_details_completed_at is not null as did_details,
  o.id_verification_completed_at  is not null as did_id,
  o.ta_signed_at                  is not null as signed_ta,
  tp.is_active,
  tp.created_at
from soft_reserves sr
join tenant_profiles tp on tp.id = sr.tenant_profile_id
left join rooms r on r.id = tp.room_id
left join onboarding_progress o on o.tenant_profile_id = tp.id
where sr.preferred_move_in is not null
  and tp.moved_in_at::date <> sr.preferred_move_in
order by tp.created_at desc;

-- Duplicate profiles: one person, one room, more than one live profile.
select
  sr.prospect_email,
  tp.room_id,
  count(*)                        as live_profiles,
  array_agg(tp.id order by tp.created_at) as profile_ids
from soft_reserves sr
join tenant_profiles tp on tp.id = sr.tenant_profile_id
where tp.is_active
  and sr.prospect_email is not null
group by sr.prospect_email, tp.room_id
having count(*) > 1;
```

- [ ] **Step 2: Run it and record the count**

Run the two statements against `hyve-iot` (`diiilqpfmlxjwiaeophb`) and paste the row counts into the PR description so the blast radius is on the record.

- [ ] **Step 3: Commit**

```bash
cd /Users/mark/Desktop/hyve-website
git add docs/superpowers/plans/2026-08-13-reserve-backfill.sql
git commit -m "docs: audit query for reserve-flow date and duplicate damage"
```

---

## Out of scope, deliberately

- **No schema change.** Dropping the `now()` default on `moved_in_at` would be the belt-and-braces fix, but other writers (`invite.js`, `admin-actions.js`) rely on it and would start failing. Recorded as a follow-up.
- **No backfill mutation.** Task 3 produces the list only.
- **The shared `setMonth` overflow** (31 Jan + 1 month lands in March) exists identically in the admin UI. The new helper matches it on purpose. Fixing both together is a separate change.
- **Julia's missing $1,500 deposit** is a payments reconciliation question, not a code defect, and is tracked on its own loop.
