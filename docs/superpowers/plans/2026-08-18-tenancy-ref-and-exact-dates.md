# Tenancy Ref Numbers + Exact Tenancy Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tenancy gets an auto-generated reference number in the form `CP-2026-001`, and the booking flow captures the prospect's real move-in AND move-out dates so `licence_period`, the fee schedule and the licence agreement all generate without an admin retyping anything.

**Architecture:** The two contract fields that are currently null on self-booked tenants (`onboarding_progress.ref_number`, `onboarding_progress.licence_period`) get filled by a single Postgres BEFORE INSERT OR UPDATE trigger, so every writer (claim-reserve API, admin invite page, admin detail page, future imports) is covered by one rule instead of three copies. The serial is allocated atomically from a `tenancy_ref_counters` table so two concurrent claims cannot mint the same ref. Separately, the reserve form on book.lazybee.sg gains an explicit move-out date (with month quick-picks that just set it), a new `soft_reserves.preferred_move_out` column carries it, and `buildOnboardingSeed` prefers it over the derived `start + N months - 1 day`.

**Tech Stack:** Postgres (Supabase project `diiilqpfmlxjwiaeophb`, hyve-iot), Next.js 15 App Router + vitest (`/Users/mark/Desktop/hyve-booking`), Vite React + Vercel serverless functions + `node --test` (`/Users/mark/Desktop/hyve-website`).

---

## Background: what is actually broken

`src/lib/reserveOnboarding.js:110` (`buildOnboardingSeed`) writes only `tenancy_start_date`, `tenancy_end_date` and `deposit_amount`. It never writes `licence_period` or `ref_number`. Those two are only written by `AdminOnboardingPage.jsx:250-253` (admin invite) or typed by hand on `AdminOnboardingDetailPage.jsx:360-363`. So every prospect who self-books on book.lazybee.sg lands with both fields null.

Consequence, confirmed against live data: 8 of 19 active tenants have a null `ref_number`, and `public/templates/licence-agreement.html` contains `{{REF_NUMBER}}`, so `AdminDocumentsPage.jsx:179` substitutes the literal string `[REF_NUMBER]` into the generated agreement.

Second problem: the reserve form only offers a duration dropdown of `[3, 6, 9, 12, 18, 24]` months, and the end date is derived as `start + N months - 1 day`. Real deals do not land on those boundaries. Julia Rönkkö picked 8 Sep 2026 + 3 months, which derives to 7 Dec 2026, but her actual tenancy runs to 19 Dec 2026, so an admin had to hand-correct the row on 17 Aug.

## Decisions locked in

1. **Ref format:** `<PREFIX>-<YYYY>-<NNN>`. `PREFIX` is the property code, i.e. everything before the first `-` in `rooms.unit_code` (`CP-PR1` gives `CP`). `YYYY` is the year of `tenancy_start_date`, falling back to the current year when the start date is not yet known. `NNN` is a 3-digit zero-padded serial.
2. **Serial scope is per property per year, and it continues from what already exists.** Live max for 2026 is CP 024, IH 026, TG 006, so the next CP tenancy becomes `CP-2026-025`, not `CP-2026-001`. Restarting at 001 would produce refs that read as duplicates of the historical ones.
3. **Non-canonical legacy refs are left alone.** `IH-STD4-2026`, `CP-PR3-2026` and `IH-STD2-2026` do not match the pattern and are not rewritten or counted.
4. **The trigger only fills blanks.** An explicitly typed ref or period always wins. The trigger never overwrites a non-empty value.
5. **Booking form keeps a fast path.** The duration dropdown becomes a row of quick-pick chips that set the move-out date, and the move-out date itself is an editable date input. `duration_months` stays populated (derived) so the availability gate, the pricing quote and the WhatsApp deep link keep working.
6. **Month arithmetic matches what production already uses:** the calendar-month span `(endYear - startYear) * 12 + (endMonth - startMonth)`, floored at 1, exactly as `AdminOnboardingPage.jsx:106-113` computes it. 8 Sep to 19 Dec gives 3.
7. **No new end-date availability block.** Rule 17 says overbooking is deliberate, so the move-out date is not validated against `rooms.available_until`. The existing move-in gate is unchanged.

## File Structure

**hyve-website** (`/Users/mark/Desktop/hyve-website`)
- Create `supabase/migrations/20260818000000_tenancy_ref_and_period.sql` — counter table, allocator, month-span function, fill trigger, counter seed, backfill of the 8 null refs, `soft_reserves.preferred_move_out` column.
- Modify `src/lib/reserveOnboarding.js` — prefer `preferred_move_out` for the end date; derive `lease_months` from the real dates.
- Modify `src/lib/reserveOnboarding.test.js` — cover the explicit move-out path.
- Modify `api/portal/claim-reserve.js` — accept and persist `move_out`.
- Modify `src/pages/portal/AdminDocumentsPage.jsx` — preview box shows the real tenancy term instead of `licence_period`.

**hyve-booking** (`/Users/mark/Desktop/hyve-booking`)
- Create `lib/tenancyDates.ts` — `addMonthsMinusADay`, `monthSpan`, `DEFAULT_STAY_MONTHS`, `STAY_PRESETS`.
- Create `lib/tenancyDates.test.ts` — pins both functions, including the Julia case.
- Modify `lib/softReserve.ts` — carry `preferred_move_out`.
- Modify `components/ReserveDetailsForm.tsx` — move-out date input + quick-pick chips, derived duration, new validation.
- Modify `app/api/reserve/details/route.ts` — accept and store `move_out`.
- Modify `app/api/reserve/account/route.ts` — forward `move_out` to claim-reserve.
- Modify `app/reserved/[token]/page.tsx` — seed the form with the stored `preferred_move_out`.

---

### Task 1: Database migration

**Files:**
- Create: `/Users/mark/Desktop/hyve-website/supabase/migrations/20260818000000_tenancy_ref_and_period.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Tenancy reference numbers + licence period, filled at the database.
--
-- onboarding_progress is written by three separate places: api/portal/claim-reserve.js
-- (self-serve booking), AdminOnboardingPage.jsx (admin invite) and
-- AdminOnboardingDetailPage.jsx (admin edit). Only the last two ever set ref_number and
-- licence_period, so every prospect who booked themselves landed with both null and the
-- generated licence agreement printed a literal "[REF_NUMBER]". Filling them in a BEFORE
-- trigger covers every writer at once, and keeps the serial allocation atomic.

-- 1. One counter per property prefix per year.
create table if not exists public.tenancy_ref_counters (
  prefix      text not null,
  year        int  not null,
  last_serial int  not null default 0,
  primary key (prefix, year)
);

alter table public.tenancy_ref_counters enable row level security;
-- Deliberately no policies: only the service role and the security-definer
-- allocator below touch this table.

-- 2. Atomic serial allocation. The upsert is a single statement, so two concurrent
--    claim-reserve calls cannot be handed the same serial.
create or replace function public.next_tenancy_ref(p_prefix text, p_year int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serial int;
begin
  insert into public.tenancy_ref_counters as c (prefix, year, last_serial)
  values (p_prefix, p_year, 1)
  on conflict (prefix, year)
  do update set last_serial = c.last_serial + 1
  returning c.last_serial into v_serial;

  return p_prefix || '-' || p_year::text || '-' || lpad(v_serial::text, 3, '0');
end;
$$;

-- 3. Calendar-month span, identical to the arithmetic AdminOnboardingPage.jsx
--    already uses, so the UI and the database never disagree about a period.
create or replace function public.tenancy_month_span(p_start date, p_end date)
returns int
language sql
immutable
as $$
  select greatest(
    1,
    (extract(year from p_end)::int - extract(year from p_start)::int) * 12
      + (extract(month from p_end)::int - extract(month from p_start)::int)
  );
$$;

-- 4. Fill blanks only. An explicitly typed ref or period always wins.
create or replace function public.onboarding_progress_fill_contract_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_code text;
  v_prefix    text;
  v_year      int;
begin
  if new.ref_number is null or btrim(new.ref_number) = '' then
    select unit_code into v_unit_code from public.rooms where id = new.room_id;
    v_prefix := upper(split_part(coalesce(nullif(btrim(v_unit_code), ''), 'LB'), '-', 1));
    if v_prefix is null or v_prefix = '' then
      v_prefix := 'LB';
    end if;
    v_year := extract(year from coalesce(new.tenancy_start_date, current_date))::int;
    new.ref_number := public.next_tenancy_ref(v_prefix, v_year);
  end if;

  if (new.licence_period is null or btrim(new.licence_period) = '')
     and new.tenancy_start_date is not null
     and new.tenancy_end_date is not null then
    new.licence_period :=
      public.tenancy_month_span(new.tenancy_start_date, new.tenancy_end_date)::text || ' months';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_onboarding_progress_fill_contract_fields
  on public.onboarding_progress;

create trigger trg_onboarding_progress_fill_contract_fields
before insert or update on public.onboarding_progress
for each row execute function public.onboarding_progress_fill_contract_fields();

-- 5. Seed the counters from refs that already follow the canonical pattern, so the
--    sequence continues instead of reissuing numbers that are already on signed papers.
--    Legacy shapes such as IH-STD4-2026 do not match and are left untouched.
insert into public.tenancy_ref_counters (prefix, year, last_serial)
select split_part(ref_number, '-', 1),
       split_part(ref_number, '-', 2)::int,
       max(split_part(ref_number, '-', 3)::int)
from public.onboarding_progress
where ref_number ~ '^[A-Z]{2,4}-[0-9]{4}-[0-9]{1,4}$'
group by 1, 2
on conflict (prefix, year) do update
set last_serial = greatest(public.tenancy_ref_counters.last_serial, excluded.last_serial);

-- 6. Backfill every row that has no ref, oldest tenancy first so the serials read
--    in chronological order. The same UPDATE fires the trigger, which fills
--    licence_period for these rows too.
do $$
declare
  r record;
begin
  for r in
    select op.id,
           coalesce(nullif(btrim(rm.unit_code), ''), 'LB') as unit_code,
           op.tenancy_start_date
    from public.onboarding_progress op
    left join public.rooms rm on rm.id = op.room_id
    where op.ref_number is null or btrim(op.ref_number) = ''
    order by op.tenancy_start_date nulls last, op.created_at
  loop
    update public.onboarding_progress
       set ref_number = public.next_tenancy_ref(
             upper(split_part(r.unit_code, '-', 1)),
             extract(year from coalesce(r.tenancy_start_date, current_date))::int
           )
     where id = r.id;
  end loop;
end $$;

-- 7. The prospect's real move-out date, captured on the reserve form. Nullable because
--    reserves created before this migration never had one.
alter table public.soft_reserves add column if not exists preferred_move_out date;
```

- [ ] **Step 2: Apply the migration to hyve-iot**

Run (PAT comes from `~/.chudbrain/secrets.env`):

```bash
PAT=$(grep -E '^(export )?SUPABASE_ACCESS_TOKEN' ~/.chudbrain/secrets.env | sed 's/^export //' | cut -d= -f2- | tr -d '"'"' ')
python3 - "$PAT" <<'PY'
import json, sys, urllib.request
pat = sys.argv[1]
sql = open("/Users/mark/Desktop/hyve-website/supabase/migrations/20260818000000_tenancy_ref_and_period.sql").read()
req = urllib.request.Request(
    "https://api.supabase.com/v1/projects/diiilqpfmlxjwiaeophb/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
    method="POST")
print(urllib.request.urlopen(req).read().decode()[:500])
PY
```

Expected: `[]` (no rows returned by a DDL batch).

- [ ] **Step 3: Verify the backfill and the counters**

Run a query for `select prefix, year, last_serial from tenancy_ref_counters order by prefix` and for every active tenant's `ref_number, licence_period`.

Expected: zero active tenants with a null `ref_number`; counters show CP/IH/TG for 2026; the previously-null rows carry refs that continue past the existing maxima (CP past 024, IH past 026, TG past 006).

- [ ] **Step 4: Verify the trigger fires on a fresh insert**

Insert a throwaway `onboarding_progress` row with a null `ref_number` inside a transaction that is rolled back, and assert the returned `ref_number` matches `^[A-Z]{2,4}-\d{4}-\d{3}$`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mark/Desktop/hyve-website add supabase/migrations/20260818000000_tenancy_ref_and_period.sql
git -C /Users/mark/Desktop/hyve-website commit -m "feat: auto-generate tenancy ref numbers and licence period at the database"
```

---

### Task 2: Shared tenancy date maths in the booking app

**Files:**
- Create: `/Users/mark/Desktop/hyve-booking/lib/tenancyDates.ts`
- Test: `/Users/mark/Desktop/hyve-booking/lib/tenancyDates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { addMonthsMinusADay, monthSpan, DEFAULT_STAY_MONTHS, STAY_PRESETS } from "./tenancyDates";

describe("addMonthsMinusADay", () => {
  it("matches the hyve-website seed convention", () => {
    expect(addMonthsMinusADay("2026-09-08", 3)).toBe("2026-12-07");
    expect(addMonthsMinusADay("2026-09-08", 12)).toBe("2027-09-07");
  });

  it("returns null for junk", () => {
    expect(addMonthsMinusADay("", 3)).toBeNull();
    expect(addMonthsMinusADay("2026-09-08", 0)).toBeNull();
  });
});

describe("monthSpan", () => {
  it("counts calendar months, the way the admin invite screen does", () => {
    // Julia: 8 Sep to 19 Dec is booked and billed as a 3-month licence.
    expect(monthSpan("2026-09-08", "2026-12-19")).toBe(3);
    expect(monthSpan("2026-09-08", "2027-09-07")).toBe(12);
  });

  it("never returns less than one", () => {
    expect(monthSpan("2026-09-08", "2026-09-20")).toBe(1);
  });
});

describe("presets", () => {
  it("keeps 12 months as the default and offers the old dropdown values", () => {
    expect(DEFAULT_STAY_MONTHS).toBe(12);
    expect(STAY_PRESETS).toEqual([3, 6, 9, 12, 18, 24]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-booking && npx vitest run lib/tenancyDates.test.ts`
Expected: FAIL, cannot resolve `./tenancyDates`.

- [ ] **Step 3: Write the implementation**

```ts
// Tenancy date arithmetic, shared by the reserve form and the reserve API routes.
//
// Both functions are deliberate mirrors of code that already runs in hyve-website:
// addMonthsMinusADay matches src/lib/reserveOnboarding.js, and monthSpan matches the
// calendar-month sum in AdminOnboardingPage.jsx. If they drift, the booking site and
// the admin screen start disagreeing about the same tenancy.

/** The stay length pre-selected before the prospect touches anything. */
export const DEFAULT_STAY_MONTHS = 12;

/** Quick-pick stay lengths. These used to be the only choices; now they just set a date. */
export const STAY_PRESETS = [3, 6, 9, 12, 18, 24];

/**
 * start + months, minus one day, in UTC so the result never shifts with timezone.
 * Keeps JS setMonth day-overflow (31 Jan + 1 month lands in March) on purpose, because
 * hyve-website's seed builder has always behaved that way.
 */
export function addMonthsMinusADay(startDate: string, months: number): string | null {
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

/** Calendar months between two ISO dates, floored at 1. */
export function monthSpan(start: string, end: string): number {
  const s = /^(\d{4})-(\d{2})/.exec(String(start ?? ""));
  const e = /^(\d{4})-(\d{2})/.exec(String(end ?? ""));
  if (!s || !e) return 0;

  const months =
    (Number(e[1]) - Number(s[1])) * 12 + (Number(e[2]) - Number(s[2]));
  return months > 0 ? months : 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-booking && npx vitest run lib/tenancyDates.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mark/Desktop/hyve-booking add lib/tenancyDates.ts lib/tenancyDates.test.ts
git -C /Users/mark/Desktop/hyve-booking commit -m "feat: shared tenancy date maths for the reserve flow"
```

---

### Task 3: Carry the move-out date through soft_reserves

**Files:**
- Modify: `/Users/mark/Desktop/hyve-booking/lib/softReserve.ts`
- Test: `/Users/mark/Desktop/hyve-booking/lib/softReserve.test.ts`

- [ ] **Step 1: Add the failing test to the existing suite**

```ts
it("carries the prospect's move-out date onto the row", () => {
  const row = buildSoftReserveRow({
    room_id: "r1",
    property_id: "p1",
    preferred_move_in: "2026-09-08",
    preferred_move_out: "2026-12-19",
  });
  expect(row.preferred_move_out).toBe("2026-12-19");
});

it("leaves move-out null when the prospect has not picked one yet", () => {
  const row = buildSoftReserveRow({ room_id: "r1", property_id: "p1" });
  expect(row.preferred_move_out).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mark/Desktop/hyve-booking && npx vitest run lib/softReserve.test.ts`
Expected: FAIL, `preferred_move_out` is undefined and the input type rejects the property.

- [ ] **Step 3: Implement**

In `lib/softReserve.ts`, add to `SoftReserveInput`:

```ts
  preferred_move_in?: string;
  preferred_move_out?: string;
```

and to the returned row, immediately after `preferred_move_in`:

```ts
    preferred_move_out: i.preferred_move_out ?? null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/mark/Desktop/hyve-booking && npx vitest run lib/softReserve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mark/Desktop/hyve-booking add lib/softReserve.ts lib/softReserve.test.ts
git -C /Users/mark/Desktop/hyve-booking commit -m "feat: carry preferred_move_out on soft reserves"
```

---

### Task 4: Reserve form captures a real move-out date

**Files:**
- Modify: `/Users/mark/Desktop/hyve-booking/components/ReserveDetailsForm.tsx`
- Modify: `/Users/mark/Desktop/hyve-booking/app/reserved/[token]/page.tsx`

- [ ] **Step 1: Replace the duration dropdown**

In `ReserveDetailsForm.tsx`, drop `const DURATIONS = [3, 6, 9, 12, 18, 24];` and import instead:

```tsx
import { addMonthsMinusADay, monthSpan, DEFAULT_STAY_MONTHS, STAY_PRESETS } from "@/lib/tenancyDates";
import { effectiveVacate, isAvailableForDate, todayISO, windowDaysForStay, MIN_STAY_MONTHS } from "@/lib/availability";
```

Accept the stored move-out as a prop and replace the `months` state with derived state:

```tsx
export default function ReserveDetailsForm({
  token,
  defaultName,
  defaultMoveIn,
  defaultMoveOut,
  roomName,
  nextAvailable = null,
  availableUntil = null,
}: {
  token: string;
  defaultName?: string;
  defaultMoveIn?: string;
  defaultMoveOut?: string;
  roomName?: string;
  nextAvailable?: string | null;
  availableUntil?: string | null;
}) {
```

```tsx
  const [moveIn, setMoveIn] = useState(defaultMoveIn ?? "");
  const [moveOut, setMoveOut] = useState(defaultMoveOut ?? "");
  // Once the prospect edits the move-out date themselves we stop moving it for them.
  const [moveOutPicked, setMoveOutPicked] = useState(Boolean(defaultMoveOut));
  const months = moveIn && moveOut ? monthSpan(moveIn, moveOut) : DEFAULT_STAY_MONTHS;
```

```tsx
  // Keep move-out trailing move-in at the default stay until the prospect sets it.
  useEffect(() => {
    if (!moveIn || moveOutPicked) return;
    const end = addMonthsMinusADay(moveIn, DEFAULT_STAY_MONTHS);
    if (end) setMoveOut(end);
  }, [moveIn, moveOutPicked]);

  function pickPreset(n: number) {
    if (!moveIn) return;
    const end = addMonthsMinusADay(moveIn, n);
    if (!end) return;
    setMoveOut(end);
    setMoveOutPicked(true);
  }
```

Add `useEffect` to the React import.

- [ ] **Step 2: Replace the form controls**

Swap the `grid grid-cols-2` block for:

```tsx
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("room.moveInDate")}</label>
          <input required type="date" min={minMoveIn} max={maxMoveIn} value={moveIn} onChange={(e) => setMoveIn(e.target.value)} className={field} />
          {nextAvailable && nextAvailable > today && (
            <p className="lb-fine mt-1.5">Free from {fmt(minMoveIn)}</p>
          )}
        </div>
        <div>
          <label className={label}>Move-out date</label>
          <input
            required
            type="date"
            min={moveIn || minMoveIn}
            value={moveOut}
            onChange={(e) => { setMoveOut(e.target.value); setMoveOutPicked(true); }}
            className={field}
          />
          {moveIn && moveOut && moveOut > moveIn && (
            <p className="lb-fine mt-1.5">{months} {months === 1 ? "month" : "months"}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {STAY_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pickPreset(n)}
            disabled={!moveIn}
            className={`border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
              moveIn && moveOut === addMonthsMinusADay(moveIn, n)
                ? "border-accent bg-accent/15 text-accent-text"
                : "border-line bg-surface text-foreground-variant hover:border-[var(--muted)]"
            }`}
          >
            {n} months
          </button>
        ))}
      </div>
```

- [ ] **Step 3: Update validation and the submit payload**

```tsx
    if (!name.trim() || !email.trim() || password.length < 8 || !moveIn || !moveOut)
      return setErr("Add your name, email, a password (8+ characters), and your move-in and move-out dates.");
    if (moveOut <= moveIn)
      return setErr("Your move-out date needs to be after your move-in date.");
    if (months < MIN_STAY_MONTHS)
      return setErr(`Our minimum stay is ${MIN_STAY_MONTHS} months.`);
    if (!isAvailableForDate({ next_available: nextAvailable, available_until: availableUntil }, moveIn, today, months))
```

and the body:

```tsx
        body: JSON.stringify({ token, email, password, name, move_in: moveIn, move_out: moveOut, duration_months: months, has_pass: hasPass }),
```

- [ ] **Step 4: Pass the stored move-out in from the page**

In `app/reserved/[token]/page.tsx`, add `preferred_move_out` to the select on line 21, to the `sr` type on line 41, and pass `defaultMoveOut={sr?.preferred_move_out}` to `<ReserveDetailsForm>`.

- [ ] **Step 5: Typecheck, lint and build**

Run: `cd /Users/mark/Desktop/hyve-booking && npx tsc --noEmit && npm run lint && npm run test`
Expected: no type errors, no lint errors, all vitest suites pass.

- [ ] **Step 6: Commit**

```bash
git -C /Users/mark/Desktop/hyve-booking add components/ReserveDetailsForm.tsx "app/reserved/[token]/page.tsx"
git -C /Users/mark/Desktop/hyve-booking commit -m "feat: capture an exact move-out date on the reserve form"
```

---

### Task 5: Reserve API routes carry the move-out date

**Files:**
- Modify: `/Users/mark/Desktop/hyve-booking/app/api/reserve/details/route.ts`
- Modify: `/Users/mark/Desktop/hyve-booking/app/api/reserve/account/route.ts`
- Modify: `/Users/mark/Desktop/hyve-booking/app/api/reserve/route.ts`

- [ ] **Step 1: details route**

Add `move_out?: string;` to the body type, then:

```ts
  const moveOut = String(body.move_out ?? "").trim();
```

and include it in the update:

```ts
    .update({
      prospect_name: name,
      preferred_move_in: moveIn,
      preferred_move_out: moveOut || null,
      duration_months: duration,
      has_pass: true,
      updated_at: new Date().toISOString(),
    })
```

- [ ] **Step 2: account route**

Add `move_out: body.move_out,` to the JSON forwarded to `/api/portal/claim-reserve`, directly after `move_in`.

- [ ] **Step 3: reserve route**

Add `preferred_move_out: body.preferred_move_out,` to the `buildSoftReserveRow` call, and `preferred_move_out?: string;` to `ReserveInput` in `lib/reserve.ts`.

- [ ] **Step 4: Verify**

Run: `cd /Users/mark/Desktop/hyve-booking && npx tsc --noEmit && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mark/Desktop/hyve-booking add app/api/reserve lib/reserve.ts
git -C /Users/mark/Desktop/hyve-booking commit -m "feat: pass the move-out date through the reserve routes"
```

---

### Task 6: Seed the tenancy from the real move-out date

**Files:**
- Modify: `/Users/mark/Desktop/hyve-website/src/lib/reserveOnboarding.js`
- Test: `/Users/mark/Desktop/hyve-website/src/lib/reserveOnboarding.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test("an explicit move-out date beats the derived one", () => {
  const reserve = {
    room_id: "r1",
    property_id: "p1",
    preferred_move_in: "2026-09-08",
    preferred_move_out: "2026-12-19",
    duration_months: 3,
  };
  const seed = buildOnboardingSeed({ tenantProfileId: "t1", reserve, room: null });
  assert.equal(seed.tenancy_start_date, "2026-09-08");
  assert.equal(seed.tenancy_end_date, "2026-12-19");

  const profile = buildProfileSeed({ reserve, room: null });
  assert.equal(profile.lease_end, "2026-12-19");
  assert.equal(profile.lease_months, 3);
});

test("without a move-out date it still derives from the duration", () => {
  const reserve = { room_id: "r1", property_id: "p1", preferred_move_in: "2026-09-08", duration_months: 3 };
  const seed = buildOnboardingSeed({ tenantProfileId: "t1", reserve, room: null });
  assert.equal(seed.tenancy_end_date, "2026-12-07");
});

test("monthSpan counts calendar months, floored at one", () => {
  assert.equal(monthSpan("2026-09-08", "2026-12-19"), 3);
  assert.equal(monthSpan("2026-09-08", "2027-09-07"), 12);
  assert.equal(monthSpan("2026-09-08", "2026-09-20"), 1);
});
```

Add `monthSpan` to the import list at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mark/Desktop/hyve-website && node --test src/lib/reserveOnboarding.test.js`
Expected: FAIL, `monthSpan` is not exported and `tenancy_end_date` comes back as `2026-12-07`.

- [ ] **Step 3: Implement**

Add to `src/lib/reserveOnboarding.js`:

```js
/**
 * Calendar months between two ISO dates, floored at 1.
 *
 * Mirrors AdminOnboardingPage.jsx and hyve-booking's lib/tenancyDates.ts so that a
 * tenancy has the same stated length wherever it is displayed.
 */
export function monthSpan(start, end) {
  const s = /^(\d{4})-(\d{2})/.exec(String(start ?? ""));
  const e = /^(\d{4})-(\d{2})/.exec(String(end ?? ""));
  if (!s || !e) return 0;

  const months = (Number(e[1]) - Number(s[1])) * 12 + (Number(e[2]) - Number(s[2]));
  return months > 0 ? months : 1;
}
```

In `buildProfileSeed`, replace the move-in block with:

```js
  const moveIn = r.preferred_move_in || null;
  if (moveIn) {
    seed.moved_in_at = moveIn;

    // The prospect's own move-out date wins. Real tenancies rarely land exactly on
    // start + N months, and the derived value used to have to be hand-corrected.
    const end = r.preferred_move_out || addMonthsMinusADay(moveIn, Number(r.duration_months));
    if (end) {
      seed.lease_end = end;
      seed.lease_months = monthSpan(moveIn, end);
    }
  }
```

In `buildOnboardingSeed`, replace the move-in block with:

```js
  const moveIn = r.preferred_move_in || null;
  if (moveIn) {
    seed.tenancy_start_date = moveIn;
    const end = r.preferred_move_out || addMonthsMinusADay(moveIn, Number(r.duration_months));
    if (end) seed.tenancy_end_date = end;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mark/Desktop/hyve-website && node --test src/lib/reserveOnboarding.test.js`
Expected: PASS, every test including the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mark/Desktop/hyve-website add src/lib/reserveOnboarding.js src/lib/reserveOnboarding.test.js
git -C /Users/mark/Desktop/hyve-website commit -m "feat: seed the tenancy from the prospect's real move-out date"
```

---

### Task 7: claim-reserve accepts the move-out date

**Files:**
- Modify: `/Users/mark/Desktop/hyve-website/api/portal/claim-reserve.js`

- [ ] **Step 1: Destructure it**

```js
  const { token, email, password, name, move_in, move_out, duration_months, has_pass } =
    req.body || {};
```

- [ ] **Step 2: Fold it into the seed**

```js
  const seedReserve = {
    ...sr,
    preferred_move_in: move_in || sr.preferred_move_in,
    preferred_move_out: move_out || sr.preferred_move_out,
    duration_months: duration_months ?? sr.duration_months,
  };
```

- [ ] **Step 3: Persist it back onto the reserve**

```js
    preferred_move_in: move_in || sr.preferred_move_in,
    preferred_move_out: move_out || sr.preferred_move_out,
```

in `reserveUpdate`.

- [ ] **Step 4: Verify**

Run: `cd /Users/mark/Desktop/hyve-website && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mark/Desktop/hyve-website add api/portal/claim-reserve.js
git -C /Users/mark/Desktop/hyve-website commit -m "feat: claim-reserve persists the prospect's move-out date"
```

---

### Task 8: Agreement modal shows the real tenancy term

**Files:**
- Modify: `/Users/mark/Desktop/hyve-website/src/pages/portal/AdminDocumentsPage.jsx`

- [ ] **Step 1: Lift the date formatter to module scope**

Above `export default function AdminDocumentsPage()`:

```jsx
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }) : "";
```

and delete the two local `const fmtDate = ...` declarations inside `handleGenerate` and `handleSendToMember`.

- [ ] **Step 2: Show the term instead of the free-text period**

Replace the `Period:` line in the preview panel with:

```jsx
                    <p><span className="text-foreground-variant">Term:</span> <strong>{fmtDate(ob?.tenancy_start_date) || "-"}</strong> to <strong>{fmtDate(ob?.tenancy_end_date) || "-"}</strong>{ob?.licence_period ? ` · ${ob.licence_period}` : ""}</p>
```

- [ ] **Step 3: Verify**

Run: `cd /Users/mark/Desktop/hyve-website && npm run lint && npm run build:client`
Expected: clean lint, successful build.

- [ ] **Step 4: Commit**

```bash
git -C /Users/mark/Desktop/hyve-website add src/pages/portal/AdminDocumentsPage.jsx
git -C /Users/mark/Desktop/hyve-website commit -m "fix: show the real tenancy term in the agreement preview"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Confirm no active tenant is missing contract fields**

Query hyve-iot for every active tenant's `ref_number` and `licence_period`. Expected: zero nulls.

- [ ] **Step 2: Regenerate Julia's agreement**

Open the Contract Generator, select Julia Johanna Rönkkö, confirm the preview shows `8 September 2026 to 19 December 2026 · 3 months` and a real ref, generate, and grep the downloaded HTML for `[REF_NUMBER]`.
Expected: no `[` placeholders remain.

- [ ] **Step 3: Walk the booking flow**

On a preview deploy of book.lazybee.sg, open a reserve link, set a move-in, override the move-out to a date that is not a whole number of months, submit, and confirm `soft_reserves.preferred_move_out` and `onboarding_progress.tenancy_end_date` both hold that exact date, with `ref_number` and `licence_period` populated.

- [ ] **Step 4: Push both repos**

```bash
git -C /Users/mark/Desktop/hyve-website push
git -C /Users/mark/Desktop/hyve-booking push
```

## Risks

- The trigger mints a ref on any UPDATE of a row that has none, so a bulk update of legacy rows allocates serials. This is intended (no row should stay blank), but it means serial numbers are not dense over time. Acceptable: refs identify, they do not count.
- `security definer` on `next_tenancy_ref` is required so the trigger can write the counter table under RLS. It takes only a prefix and a year and can leak nothing.
- Replacing the duration dropdown touches the live conversion funnel. The quick-pick chips preserve the one-tap path and 12 months stays pre-selected, so the number of required interactions is unchanged for anyone who accepts a standard term.
