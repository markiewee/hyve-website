# Channel Worker Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reconciliation loop from the spec so the Mac mini can read every Roomies listing, report what it actually sees, and surface drift against the room calendar, without writing anything to Roomies.

**Architecture:** The database holds desired state derived from `room_calendar` and observed state reported by workers. Workers never receive instructions; they claim drifting placements through `fn_claim_listing_work`, act, read back, and report through `fn_report_listing_result`. This plan builds the contract and a report-only Roomies worker. The push path is deliberately out of scope, see Non-Goals.

**Tech Stack:** Postgres 15 on Supabase (hyve-iot `diiilqpfmlxjwiaeophb`), plpgsql, React 18 + Vite portal, Python 3.13 + Playwright 1.62 on the Mac mini, launchd.

**Spec:** `docs/integrations/channel-worker-contract-v1.md`. Read it first. Every design question is answered there and is not re-argued here.

---

## Ground truth verified before planning

Do not re-derive these. They were checked against production on 2026-08-09.

| Fact | Value |
| --- | --- |
| `listing_placements` row count | **0**. Every placement must be created. |
| `listing_channels` row count | 13, including `roomies` (added by migration `20260810000006`) |
| `listing_placements.status` allowed values | `NOT_LISTED`, `PENDING`, `LIVE`, `PAUSED`, `ERROR` (check constraint) |
| Existing columns on `listing_placements` | `id, room_id, channel_id, external_id, url, status, last_pushed_at, last_verified_at, last_drift, last_error, created_at, updated_at, desired_state, desired_computed_at` |
| Lettable rooms | 19, those with `room_type is not null`. The table holds 34 rows; the rest are common areas and yards. |
| Existing functions | `fn_room_next_available(room_id, from_date, min_days)`, `fn_listing_desired_state(room_id, currently_on, today, on_days, off_days)` |
| Existing view | `v_roomies_listing_state`, already `security_invoker = on` |
| Rooms where stored and derived availability disagree | 3: `IH-PR1`, `IH-STD2`, `TG-PR3` |
| Portal test command | `node --test src/lib/<name>.test.js`. ESM, `node:test` + `node:assert/strict`. There is no `npm test` script. |
| Mini runtime | `~/.claude/tools/roomies/.venv` (Playwright 1.62), profile `~/.claude/browser-profiles/roomies` |

## Open decision that blocks Task 10: what credential the worker uses

Spec section 9 says each worker gets its own credential, never a shared service
key. Supabase does not make that free, and this plan will not pretend otherwise.
Decide before Task 10, because the answer changes two lines of `worker.py` and
nothing else.

| Option | What it is | Trade-off |
| --- | --- | --- |
| **A. Signed JWT with a `worker_id` claim (recommended)** | Mint a long-lived JWT with the project JWT secret carrying `role: authenticated` and a custom `worker_id`. Each function additionally checks the claim matches the `p_worker_id` argument. | Genuinely per-worker and revocable by rotating one claim. Costs about 20 lines: a mint script and one `current_setting('request.jwt.claims')` check per function. |
| **B. Service role key** | The mini holds the project service key. | One line of work, and the mini can then do anything to any table in the database. A stolen mini is a stolen database. The registration check becomes decoration. |
| **C. Dedicated Postgres role + PostgREST** | A real database role with grants only on the four functions. | The most correct, and the most setup. Worth it at three or four workers, overkill at one. |

Recommendation is A. Until it is chosen, `ROOMIES_WORKER_KEY` in Task 10 and
Task 11 has no correct value, and those tasks cannot be run. Every task before
Task 10 is unaffected.

## Non-Goals

Out of scope for this plan, each needing its own approval:

- **Writing anything to Roomies.** Mark's rule of 9 Aug 2026 (Chrome extension only for Roomies) stands until he retires it. The worker here is report-only.
- **The approval UI button and the off-push.** The schema and function land here; the button and the push land in the follow-up plan once drift has been correct for a week.
- **Pointing `hyve-booking` at `fn_room_next_available`.** This is the real fix for the 3 drifting rooms and it is a different repo. Spec section 8.
- **Any channel other than Roomies.**

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260811000001_channel_worker_schema.sql` | State columns, `channel_workers`, `listing_push_log`. Data only, no logic. |
| `supabase/migrations/20260811000002_channel_worker_api.sql` | The four functions. All behaviour, all guards. |
| `supabase/migrations/20260811000003_channel_worker_views.sql` | `v_channel_worker_health`, and `v_roomies_listing_state` extended with observed state. |
| `src/lib/listingDrift.js` | Pure drift comparison and formatting for the portal. No I/O. |
| `src/lib/listingDrift.test.js` | `node --test`. |
| `src/pages/portal/AdminListingsPage.jsx` | Availability tab renders observed state and worker health. Modify only. |
| `~/.claude/tools/roomies/worker.py` (mini) | The report-only worker. Claims, reads back, reports, heartbeats. |
| `~/.claude/tools/roomies/roomies_page.py` (mini) | The only Roomies-specific code: `read_listing(page, url) -> observed`. Isolated so a Roomies redesign touches one file. |
| `workers/roomies/` (repo root, new directory) | Reviewed copies of everything that runs on the mini. The mini executes from `~/.claude/tools/roomies/`; git is where it gets read and reviewed. Keep them in step by hand; there is no deploy step. |

Splitting `roomies_page.py` from `worker.py` is the important boundary: the worker knows the contract and nothing about Roomies; the page module knows Roomies and nothing about the contract. A new channel reuses `worker.py` unchanged.

---

### Task 1: State columns and worker tables

**Files:**
- Create: `supabase/migrations/20260811000001_channel_worker_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Channel worker contract v1, part 1: state.
-- Spec: docs/integrations/channel-worker-contract-v1.md
-- Data shape only. Every guard and behaviour lives in part 2 so that the rules
-- cannot be bypassed by a worker writing a column directly.

begin;

-- ── Observed state, and the claim ───────────────────────────────────────────
alter table public.listing_placements
  add column if not exists observed_state       jsonb,
  add column if not exists observed_at          timestamptz,
  add column if not exists claimed_by           text,
  add column if not exists claim_token          uuid,
  add column if not exists claim_expires_at     timestamptz,
  add column if not exists approved_at          timestamptz,
  add column if not exists approved_by          uuid,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists push_count_date      date,
  add column if not exists push_count           integer not null default 0,
  add column if not exists frozen_reason        text;

comment on column public.listing_placements.observed_state is
  'What the platform ACTUALLY showed when a worker last looked. Never what a '
  'worker intended to set. Spec section 4.2.';
comment on column public.listing_placements.claim_token is
  'Issued by fn_claim_listing_work. A report carrying a stale token is rejected, '
  'so a worker that stalled past its claim cannot overwrite a newer result.';
comment on column public.listing_placements.frozen_reason is
  'Non-null means no worker will claim this placement until a human clears it.';

-- ── Who is out there, and is it alive ───────────────────────────────────────
create table if not exists public.channel_workers (
  worker_id    text        primary key,
  channel_slug text        not null references public.listing_channels(slug),
  last_seen_at timestamptz not null default now(),
  note         jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.channel_workers is
  'Registered workers. Also the liveness signal: a worker that is asleep, '
  'crashed or unplugged produces exactly the same database as one with nothing '
  'to do, so absence of a heartbeat is the only way to tell them apart.';

-- ── Every attempt, attributable ─────────────────────────────────────────────
create table if not exists public.listing_push_log (
  id           uuid        primary key default gen_random_uuid(),
  placement_id uuid        not null references public.listing_placements(id) on delete cascade,
  worker_id    text        not null,
  at           timestamptz not null default now(),
  intent       jsonb,
  observed     jsonb,
  ok           boolean     not null,
  error        text
);

create index if not exists listing_push_log_placement_at_idx
  on public.listing_push_log (placement_id, at desc);

comment on table public.listing_push_log is
  'One row per worker attempt. Answers "who turned that listing off, and when".';

-- ── RLS: workers reach these only through security-definer functions ────────
alter table public.channel_workers   enable row level security;
alter table public.listing_push_log  enable row level security;

revoke all on public.channel_workers  from anon, authenticated;
revoke all on public.listing_push_log from anon, authenticated;

commit;
```

- [ ] **Step 2: Dry-run it, then confirm production is untouched**

Run the migration body wrapped so it cannot land, by replacing the final
`commit;` with `rollback;` and executing it against hyve-iot. Then verify
nothing was created:

```sql
select count(*) as should_be_zero
  from information_schema.columns
 where table_name = 'listing_placements' and column_name = 'observed_state';
```

Expected: `should_be_zero = 0`. If it is 1, the rollback did not happen. Stop and
investigate before continuing.

- [ ] **Step 3: Apply for real**

Execute the migration as written, with `commit;`.

- [ ] **Step 4: Verify it landed**

```sql
select
  (select count(*) from information_schema.columns
    where table_name='listing_placements'
      and column_name in ('observed_state','claim_token','frozen_reason','push_count')) as new_cols,
  (select count(*) from information_schema.tables
    where table_name in ('channel_workers','listing_push_log'))                          as new_tables,
  (select count(*) from pg_tables
    where tablename in ('channel_workers','listing_push_log') and rowsecurity)           as rls_on;
```

Expected: `new_cols = 4`, `new_tables = 2`, `rls_on = 2`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260811000001_channel_worker_schema.sql
git commit -m "feat: channel worker state columns, worker registry, push log"
```

---

### Task 2: Heartbeat

Smallest function in the contract. Build it first to establish the
security-definer and registration-check pattern that the other three copy.

**Files:**
- Create: `supabase/migrations/20260811000002_channel_worker_api.sql`

- [ ] **Step 1: Write the failing test**

Save as a scratch SQL file and run it against hyve-iot. It asserts loudly.

```sql
do $$
begin
  perform public.fn_worker_heartbeat('test-worker', 'roomies');
  raise exception 'FAIL: expected fn_worker_heartbeat not to exist yet';
exception
  when undefined_function then
    raise notice 'PASS: function does not exist yet, as expected';
end $$;
```

- [ ] **Step 2: Run it to verify it fails in the right way**

Expected output: `NOTICE: PASS: function does not exist yet, as expected`. If it
raises `FAIL`, the function already exists and this task is already done.

- [ ] **Step 3: Write the implementation**

Create the migration file with this content:

```sql
-- Channel worker contract v1, part 2: the API.
-- Spec: docs/integrations/channel-worker-contract-v1.md sections 4 and 7.
--
-- All four functions are security definer and all begin by checking the caller
-- named a worker registered to the channel it claims. A worker therefore cannot
-- reach another channel's placements even if it asks.

begin;

create or replace function public.fn_worker_heartbeat(
  p_worker_id    text,
  p_channel_slug text,
  p_note         jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or p_channel_slug is null then
    raise exception 'worker_id and channel_slug are required';
  end if;

  if not exists (select 1 from public.listing_channels where slug = p_channel_slug) then
    raise exception 'unknown channel %', p_channel_slug;
  end if;

  insert into public.channel_workers (worker_id, channel_slug, last_seen_at, note)
  values (p_worker_id, p_channel_slug, now(), p_note)
  on conflict (worker_id) do update
    set last_seen_at = now(),
        note         = coalesce(excluded.note, public.channel_workers.note),
        channel_slug = excluded.channel_slug;
end;
$$;

comment on function public.fn_worker_heartbeat is
  'Called every run and on a timer regardless of whether there was work. '
  'Silence and success are otherwise indistinguishable. Spec section 4.3.';

commit;
```

- [ ] **Step 4: Apply and verify it passes**

```sql
select public.fn_worker_heartbeat('test-worker', 'roomies');
select worker_id, channel_slug, (now() - last_seen_at) < interval '10 seconds' as fresh
  from public.channel_workers where worker_id = 'test-worker';
```

Expected: one row, `fresh = true`.

- [ ] **Step 5: Verify the unknown-channel guard**

```sql
do $$
begin
  perform public.fn_worker_heartbeat('test-worker', 'not-a-channel');
  raise exception 'FAIL: unknown channel was accepted';
exception
  when others then
    if sqlerrm like 'unknown channel%' then
      raise notice 'PASS: %', sqlerrm;
    else
      raise;
    end if;
end $$;
```

Expected: `NOTICE: PASS: unknown channel not-a-channel`.

- [ ] **Step 6: Clean up the test row and commit**

```sql
delete from public.channel_workers where worker_id = 'test-worker';
```

```bash
git add supabase/migrations/20260811000002_channel_worker_api.sql
git commit -m "feat: fn_worker_heartbeat, worker liveness signal"
```

---

### Task 3: Claim work, with every refusal guard

The heart of the contract. Every safety rule in spec section 7 is enforced here
so that a badly written worker cannot escape it.

**Files:**
- Modify: `supabase/migrations/20260811000002_channel_worker_api.sql` (append)

- [ ] **Step 1: Write the failing test**

```sql
do $$
begin
  perform * from public.fn_claim_listing_work('roomies', 'test-worker', 10);
  raise exception 'FAIL: expected fn_claim_listing_work not to exist yet';
exception
  when undefined_function then
    raise notice 'PASS: not implemented yet';
end $$;
```

- [ ] **Step 2: Run it, expect PASS notice**

Expected: `NOTICE: PASS: not implemented yet`.

- [ ] **Step 3: Append the implementation**

```sql
begin;

create or replace function public.fn_claim_listing_work(
  p_channel_slug text,
  p_worker_id    text,
  p_limit        integer default 25
)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_ttl        interval := interval '5 minutes';
begin
  -- Registration check. Same first move in all four functions.
  if not exists (
    select 1 from public.channel_workers
     where worker_id = p_worker_id and channel_slug = p_channel_slug
  ) then
    raise exception 'worker % is not registered for channel %', p_worker_id, p_channel_slug;
  end if;

  -- A disabled channel is the kill switch. One field, no deploy. Reporting
  -- continues elsewhere; claiming stops dead.
  select id into v_channel_id
    from public.listing_channels
   where slug = p_channel_slug and enabled = true;

  if v_channel_id is null then
    return;   -- no rows. Not an error: "nothing to do" is the honest answer.
  end if;

  return query
  with candidate as (
    select lp.id
      from public.listing_placements lp
      join public.rooms r on r.id = lp.room_id
     where lp.channel_id = v_channel_id
       and r.room_type is not null
       -- Never claim what someone else holds.
       and (lp.claim_expires_at is null or lp.claim_expires_at < now())
       -- A placement with no external id has nothing to act on. Spec section 10.
       and lp.external_id is not null
       -- Frozen after repeated failure or a runaway loop. Needs a human.
       and lp.frozen_reason is null
       and lp.consecutive_failures < 5
       -- Daily push cap. Protects the platform account from looking like an attack.
       and not (lp.push_count_date = current_date and lp.push_count >= 5)
       -- Refuse to act on data we do not trust. Spec section 8. Today this
       -- excludes IH-PR1, IH-STD2 and TG-PR3.
       and r.next_available is not distinct from public.fn_room_next_available(r.id)
       -- Only actual drift is work.
       and (
             coalesce((lp.desired_state->>'on')::boolean, false)
               is distinct from coalesce((lp.observed_state->>'on')::boolean, false)
          or coalesce(lp.desired_state->>'headline', '')
               is distinct from coalesce(lp.observed_state->>'headline', '')
           )
       -- Turning a listing OFF needs a human yes. On, and headline edits, do
       -- not. Spec section 6.
       and (
             coalesce((lp.desired_state->>'on')::boolean, false) = true
          or coalesce((lp.observed_state->>'on')::boolean, false) = false
          or lp.approved_at is not null
           )
     order by lp.observed_at nulls first, lp.id
     limit p_limit
     for update of lp skip locked
  ),
  claimed as (
    update public.listing_placements lp
       set claimed_by       = p_worker_id,
           claim_token      = gen_random_uuid(),
           claim_expires_at = now() + v_ttl,
           updated_at       = now()
      from candidate c
     where lp.id = c.id
     returning lp.*
  )
  select jsonb_build_object(
           'placement_id',     cl.id,
           'lazybee_ref',      r.lazybee_ref,
           'unit_code',        r.unit_code,
           'external_id',      cl.external_id,
           'url',              cl.url,
           'desired',          cl.desired_state,
           'observed',         cl.observed_state,
           'claim_token',      cl.claim_token,
           'claim_expires_at', cl.claim_expires_at)
    from claimed cl
    join public.rooms r on r.id = cl.room_id;
end;
$$;

comment on function public.fn_claim_listing_work is
  'Claims drifting placements a worker is cleared to act on. An empty result '
  'always means "nothing to do", never "something went wrong". Every refusal '
  'reason is in spec section 4.1.';

commit;
```

- [ ] **Step 4: Verify the kill switch, before any data exists**

`roomies` ships with `enabled = false`, so this must return zero rows.

```sql
select public.fn_worker_heartbeat('test-worker', 'roomies');
select count(*) as should_be_zero
  from public.fn_claim_listing_work('roomies', 'test-worker', 10);
```

Expected: `should_be_zero = 0`.

- [ ] **Step 5: Verify the registration guard**

```sql
do $$
begin
  perform * from public.fn_claim_listing_work('roomies', 'ghost-worker', 10);
  raise exception 'FAIL: unregistered worker was allowed to claim';
exception
  when others then
    if sqlerrm like '%is not registered%' then
      raise notice 'PASS: %', sqlerrm;
    else raise;
    end if;
end $$;
```

Expected: `NOTICE: PASS: worker ghost-worker is not registered for channel roomies`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260811000002_channel_worker_api.sql
git commit -m "feat: fn_claim_listing_work with kill switch, freeze, cap and approval guards"
```

---

### Task 4: Report the result

**Files:**
- Modify: `supabase/migrations/20260811000002_channel_worker_api.sql` (append)

- [ ] **Step 1: Write the failing test**

```sql
do $$
begin
  perform public.fn_report_listing_result(
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    '{}'::jsonb, null);
  raise exception 'FAIL: expected fn_report_listing_result not to exist yet';
exception
  when undefined_function then raise notice 'PASS: not implemented yet';
end $$;
```

- [ ] **Step 2: Run it, expect PASS notice**

Expected: `NOTICE: PASS: not implemented yet`.

- [ ] **Step 3: Append the implementation**

```sql
begin;

create or replace function public.fn_report_listing_result(
  p_placement_id uuid,
  p_claim_token  uuid,
  p_observed     jsonb,
  p_error        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lp      public.listing_placements%rowtype;
  v_drift boolean;
  v_ok    boolean := (p_error is null);
begin
  select * into lp from public.listing_placements where id = p_placement_id for update;
  if not found then
    raise exception 'no such placement %', p_placement_id;
  end if;

  -- A stale token means this worker stalled past its claim and someone else may
  -- already have done the work. Refuse rather than overwrite a newer result.
  if lp.claim_token is distinct from p_claim_token then
    raise exception 'stale or invalid claim token for placement %', p_placement_id;
  end if;

  v_drift :=
       coalesce((lp.desired_state->>'on')::boolean, false)
         is distinct from coalesce((p_observed->>'on')::boolean, false)
    or coalesce(lp.desired_state->>'headline', '')
         is distinct from coalesce(p_observed->>'headline', '');

  update public.listing_placements
     set observed_state       = p_observed,
         observed_at          = now(),
         last_verified_at     = now(),
         last_drift           = v_drift,
         last_error           = p_error,
         consecutive_failures = case when v_ok then 0 else consecutive_failures + 1 end,
         frozen_reason        = case
                                  when not v_ok and consecutive_failures + 1 >= 5
                                    then 'five consecutive failures, needs a human'
                                  else frozen_reason
                                end,
         status               = case
                                  when p_error is not null then 'ERROR'
                                  when coalesce((p_observed->>'on')::boolean, false) then 'LIVE'
                                  else 'PAUSED'
                                end,
         -- Claim released here, not by a separate call. There is no unlock to leak.
         claimed_by           = null,
         claim_token          = null,
         claim_expires_at     = null,
         -- Approval is single use. A yes to turn this listing off does not
         -- authorise the next off, weeks later, for a different reason.
         approved_at          = null,
         approved_by          = null,
         updated_at           = now()
   where id = p_placement_id;

  insert into public.listing_push_log (placement_id, worker_id, intent, observed, ok, error)
  values (p_placement_id, coalesce(lp.claimed_by, 'unknown'), lp.desired_state, p_observed, v_ok, p_error);

  return jsonb_build_object('placement_id', p_placement_id, 'drift', v_drift, 'ok', v_ok);
end;
$$;

comment on function public.fn_report_listing_result is
  'p_observed is what the worker SAW, never what it intended. A worker that '
  'clicks save, gets a silent failure and reports success has corrupted the only '
  'record we have. Spec section 4.2.';

commit;
```

- [ ] **Step 4: Verify the stale-token guard**

```sql
do $$
begin
  perform public.fn_report_listing_result(
    '00000000-0000-0000-0000-000000000000'::uuid,
    gen_random_uuid(), '{}'::jsonb, null);
  raise exception 'FAIL: accepted a report for a non-existent placement';
exception
  when others then
    if sqlerrm like 'no such placement%' then raise notice 'PASS: %', sqlerrm;
    else raise;
    end if;
end $$;
```

Expected: `NOTICE: PASS: no such placement 00000000-...`. The token path is
exercised end to end in Task 8, once a real placement exists.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260811000002_channel_worker_api.sql
git commit -m "feat: fn_report_listing_result, observed-not-intended with claim validation"
```

---

### Task 5: Approve an off-change, and link a discovered listing

Two small human-facing functions. `fn_approve_listing_change` is called by the
portal. `fn_link_placement` is how discovery records the platform's own listing
id, which is a database write, not a platform write, so it is safe in
report-only mode.

**Files:**
- Modify: `supabase/migrations/20260811000002_channel_worker_api.sql` (append)

- [ ] **Step 1: Write the failing test**

```sql
do $$
begin
  perform public.fn_link_placement('roomies', 'CP-PR1', 'x', 'https://example.com');
  raise exception 'FAIL: expected fn_link_placement not to exist yet';
exception
  when undefined_function then raise notice 'PASS: not implemented yet';
end $$;
```

- [ ] **Step 2: Run it, expect PASS notice**

Expected: `NOTICE: PASS: not implemented yet`.

- [ ] **Step 3: Append the implementation**

```sql
begin;

create or replace function public.fn_approve_listing_change(
  p_placement_id uuid,
  p_approve      boolean default true
)
returns jsonb
language plpgsql
security invoker            -- runs as the signed-in admin, so RLS applies
set search_path = public
as $$
declare v_now timestamptz := now();
begin
  update public.listing_placements
     set approved_at = case when p_approve then v_now else null end,
         approved_by = case when p_approve then auth.uid() else null end,
         updated_at  = v_now
   where id = p_placement_id;

  if not found then
    raise exception 'no such placement %', p_placement_id;
  end if;

  return jsonb_build_object('placement_id', p_placement_id, 'approved', p_approve);
end;
$$;

comment on function public.fn_approve_listing_change is
  'Sets the approval a worker waits for before turning a listing off. Security '
  'invoker on purpose: approving is a human act and must run as that human.';

create or replace function public.fn_link_placement(
  p_channel_slug text,
  p_unit_code    text,
  p_external_id  text,
  p_url          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_room_id    uuid;
  v_id         uuid;
begin
  select id into v_channel_id from public.listing_channels where slug = p_channel_slug;
  if v_channel_id is null then raise exception 'unknown channel %', p_channel_slug; end if;

  select id into v_room_id
    from public.rooms
   where upper(unit_code) = upper(p_unit_code) and room_type is not null;
  if v_room_id is null then raise exception 'unknown or unlettable room %', p_unit_code; end if;

  insert into public.listing_placements (room_id, channel_id, external_id, url, status)
  values (v_room_id, v_channel_id, p_external_id, p_url, 'PENDING')
  on conflict (room_id, channel_id) do update
    set external_id = excluded.external_id,
        url         = coalesce(excluded.url, public.listing_placements.url),
        updated_at  = now()
  returning id into v_id;

  return jsonb_build_object('placement_id', v_id, 'unit_code', upper(p_unit_code));
end;
$$;

comment on function public.fn_link_placement is
  'Records the platform''s own listing id against a room. A database write, not '
  'a platform write, so it is safe in report-only mode. Spec section 10 step 2.';

commit;
```

- [ ] **Step 4: Add the uniqueness the upsert depends on**

`fn_link_placement` uses `on conflict (room_id, channel_id)`, which requires a
unique constraint that does not exist yet. Append to the same migration:

```sql
begin;
create unique index if not exists listing_placements_room_channel_key
  on public.listing_placements (room_id, channel_id);
commit;
```

- [ ] **Step 5: Verify both guards**

```sql
do $$
begin
  perform public.fn_link_placement('roomies', 'CP-COMMON', 'x', null);
  raise exception 'FAIL: linked an unlettable space';
exception when others then
  if sqlerrm like 'unknown or unlettable room%' then raise notice 'PASS: %', sqlerrm;
  else raise; end if;
end $$;
```

Expected: `NOTICE: PASS: unknown or unlettable room CP-COMMON`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260811000002_channel_worker_api.sql
git commit -m "feat: fn_approve_listing_change and fn_link_placement"
```

---

### Task 6: Views for the portal

**Files:**
- Create: `supabase/migrations/20260811000003_channel_worker_views.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Channel worker contract v1, part 3: what humans read.
begin;

-- Extend the Roomies view with observed state so the tab can show desired,
-- observed and the gap between them rather than desired alone.
create or replace view public.v_roomies_listing_state as
select r.id                as room_id,
       r.lazybee_ref,
       r.unit_code,
       r.price_monthly,
       r.min_stay_months,
       lp.id               as placement_id,
       lp.external_id      as roomies_listing_id,
       lp.url              as roomies_url,
       coalesce(lp.status = 'LIVE', false) as is_live,
       lp.observed_state,
       lp.observed_at,
       lp.last_error,
       lp.consecutive_failures,
       lp.frozen_reason,
       lp.approved_at,
       -- Data we refuse to act on. Spec section 8.
       (r.next_available is distinct from public.fn_room_next_available(r.id))
                           as availability_disputed,
       s.desired
  from public.rooms r
  left join public.listing_channels c   on c.slug = 'roomies'
  left join public.listing_placements lp
         on lp.room_id = r.id and lp.channel_id = c.id
  cross join lateral (
       select public.fn_listing_desired_state(
                r.id, coalesce(lp.status = 'LIVE', false)) as desired
  ) s
 where r.room_type is not null;

-- A view runs with its owner's rights by default, which would hand anon
-- everything in listing_placements through the join.
alter view public.v_roomies_listing_state set (security_invoker = on);
revoke all on public.v_roomies_listing_state from anon;
grant select on public.v_roomies_listing_state to authenticated;

-- Worker liveness, for the health strip on the tab.
create or replace view public.v_channel_worker_health as
select w.worker_id,
       w.channel_slug,
       w.last_seen_at,
       (now() - w.last_seen_at)                        as age,
       (now() - w.last_seen_at) > interval '1 hour'    as is_stale,
       c.enabled                                       as channel_enabled
  from public.channel_workers w
  join public.listing_channels c on c.slug = w.channel_slug;

alter view public.v_channel_worker_health set (security_invoker = on);
revoke all on public.v_channel_worker_health from anon;
grant select on public.v_channel_worker_health to authenticated;

commit;
```

- [ ] **Step 2: Apply, then verify the anon hole is closed on both views**

```sql
select c.relname,
       has_table_privilege('anon', c.oid, 'select')          as anon_can_select,
       has_table_privilege('authenticated', c.oid, 'select') as auth_can_select
  from pg_class c
 where c.relname in ('v_roomies_listing_state','v_channel_worker_health');
```

Expected: both rows `anon_can_select = false`, `auth_can_select = true`.

- [ ] **Step 3: Verify the disputed flag finds exactly the three known rooms**

```sql
select unit_code from public.v_roomies_listing_state
 where availability_disputed order by unit_code;
```

Expected exactly: `IH-PR1`, `IH-STD2`, `TG-PR3`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811000003_channel_worker_views.sql
git commit -m "feat: observed state and worker health views"
```

---

### Task 7: Pure drift logic for the portal

**Files:**
- Create: `src/lib/listingDrift.js`
- Test: `src/lib/listingDrift.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// Run with: node --test src/lib/listingDrift.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { driftOf, rowStatus, sortRows } from "./listingDrift.js";

test("no observation yet is unknown, not agreement", () => {
  const d = driftOf({ on: true, headline: "Available now" }, null);
  assert.equal(d.kind, "unknown");
});

test("same on-state and headline is agreement", () => {
  const d = driftOf({ on: true, headline: "Available from 12 Aug 2026" },
                    { on: true, headline: "Available from 12 Aug 2026" });
  assert.equal(d.kind, "match");
});

test("a differing headline is drift even when both are live", () => {
  const d = driftOf({ on: true, headline: "Available from 12 Aug 2026" },
                    { on: true, headline: "Available now" });
  assert.equal(d.kind, "drift");
  assert.deepEqual(d.fields, ["headline"]);
});

test("both fields differing reports both", () => {
  const d = driftOf({ on: true, headline: "Available now" },
                    { on: false, headline: null });
  assert.deepEqual(d.fields, ["on", "headline"]);
});

test("disputed availability outranks drift, because we refuse to act on it", () => {
  assert.equal(
    rowStatus({ availability_disputed: true,
                desired: { on: true, headline: "x" }, observed_state: null }),
    "disputed");
});

test("a frozen placement reads as frozen, not as work to do", () => {
  assert.equal(
    rowStatus({ frozen_reason: "five consecutive failures, needs a human",
                desired: { on: true, headline: "x" },
                observed_state: { on: false, headline: null } }),
    "frozen");
});

test("rows needing attention sort above quiet ones", () => {
  const rows = [
    { unit_code: "A", desired: { on: true, headline: "x" }, observed_state: { on: true, headline: "x" } },
    { unit_code: "B", desired: { on: true, headline: "x" }, observed_state: { on: false, headline: null } },
    { unit_code: "C", availability_disputed: true, desired: { on: true, headline: "x" }, observed_state: null },
  ];
  assert.deepEqual(sortRows(rows).map((r) => r.unit_code), ["C", "B", "A"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/lib/listingDrift.test.js`
Expected: FAIL, `Cannot find module './listingDrift.js'`.

- [ ] **Step 3: Write the implementation**

```javascript
// Pure comparison between what a listing SHOULD say and what a worker last saw
// it say. No I/O, no Supabase, no React, so it is testable on its own.
//
// "Never observed" is deliberately its own state rather than being folded into
// drift. A row we have never looked at and a row we looked at and found correct
// are different facts, and showing them the same way would hide a worker that
// has never once run.

const NEVER_OBSERVED = { kind: "unknown", fields: [] };

export function driftOf(desired, observed) {
  if (!observed) return NEVER_OBSERVED;

  const fields = [];
  const dOn = Boolean(desired?.on);
  const oOn = Boolean(observed?.on);
  if (dOn !== oOn) fields.push("on");

  const dH = desired?.headline ?? "";
  const oH = observed?.headline ?? "";
  if (dH !== oH) fields.push("headline");

  return { kind: fields.length ? "drift" : "match", fields };
}

// Ordered by how much a human needs to look at it. Disputed data comes first
// because it is the only state no automation will ever clear on its own.
export function rowStatus(row) {
  if (row?.availability_disputed) return "disputed";
  if (row?.frozen_reason) return "frozen";
  if (row?.last_error) return "error";
  return driftOf(row?.desired, row?.observed_state).kind;
}

const RANK = { disputed: 0, frozen: 1, error: 2, drift: 3, unknown: 4, match: 5 };

export function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const d = RANK[rowStatus(a)] - RANK[rowStatus(b)];
    return d !== 0 ? d : (a.unit_code ?? "").localeCompare(b.unit_code ?? "");
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/lib/listingDrift.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/listingDrift.js src/lib/listingDrift.test.js
git commit -m "feat: pure listing drift comparison with tests"
```

---

### Task 8: Availability tab shows observed state and worker health

**Files:**
- Modify: `src/pages/portal/AdminListingsPage.jsx` (the `AvailabilityTab` component added in PR #28)

- [ ] **Step 1: Extend the data load**

In `AvailabilityTab`, replace the existing single query with both queries. The
view now carries observed state, so no extra join is needed.

```javascript
const [rows, setRows] = useState([]);
const [workers, setWorkers] = useState([]);

useEffect(() => {
  (async () => {
    const [{ data: r, error: rErr }, { data: w, error: wErr }] = await Promise.all([
      supabase.from("v_roomies_listing_state").select("*"),
      supabase.from("v_channel_worker_health").select("*").eq("channel_slug", "roomies"),
    ]);
    if (rErr || wErr) { onError((rErr ?? wErr).message); return; }
    setRows(sortRows(r ?? []));
    setWorkers(w ?? []);
  })();
}, [onError]);
```

Add the import at the top of the file:

```javascript
import { driftOf, rowStatus, sortRows } from "../../lib/listingDrift";
```

- [ ] **Step 2: Add the worker health strip above the table**

A worker that has never checked in is the failure that otherwise looks exactly
like everything being fine, so it gets its own line rather than a column.

```jsx
function WorkerHealth({ workers }) {
  if (!workers.length) {
    return (
      <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
        No worker has ever checked in for Roomies. Every observation below is
        missing, not clean.
      </p>
    );
  }
  return (
    <ul className="mb-3 text-sm">
      {workers.map((w) => (
        <li key={w.worker_id} className={w.is_stale ? "text-red-600" : "text-muted-foreground"}>
          {w.worker_id}: last seen {new Date(w.last_seen_at).toLocaleString()}
          {w.is_stale ? " (STALE, over an hour)" : ""}
          {w.channel_enabled ? "" : " · channel disabled, nothing will be pushed"}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Add an Observed column and a status column to the table**

Replace the existing table body row rendering with:

```jsx
{rows.map((r) => {
  const st = rowStatus(r);
  const d = driftOf(r.desired, r.observed_state);
  return (
    <tr key={r.room_id} className={st === "match" ? "" : "bg-accent/5"}>
      <td className="px-3 py-2 font-mono text-xs">{r.lazybee_ref}</td>
      <td className="px-3 py-2">${r.price_monthly}</td>
      <td className="px-3 py-2"><State on={r.desired?.on} emphasise /></td>
      <td className="px-3 py-2">
        {r.observed_state
          ? <State on={r.observed_state.on} />
          : <span className="text-muted-foreground">never checked</span>}
      </td>
      <td className="px-3 py-2">{r.desired?.headline ?? "-"}</td>
      <td className="px-3 py-2 text-xs">
        {st === "disputed" ? "Calendar and stored date disagree, will not act"
          : st === "frozen" ? r.frozen_reason
          : st === "error"  ? r.last_error
          : st === "drift"  ? `differs on ${d.fields.join(" and ")}`
          : st === "unknown"? "no observation yet"
          : "matches"}
      </td>
    </tr>
  );
})}
```

Update the table header cells to match: Reference, Price, Should be, Observed,
Headline, Status.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev -- --host 127.0.0.1`
Open `http://127.0.0.1:5173/portal/admin/listings?tab=availability`.
Expected: 19 rows. Every row shows "never checked" in Observed and "no
observation yet" in Status, because no worker has run. `IH-PR1`, `IH-STD2` and
`TG-PR3` sort to the top as disputed. The amber worker-health banner is visible.

- [ ] **Step 5: Commit**

```bash
git add src/pages/portal/AdminListingsPage.jsx
git commit -m "feat: availability tab shows observed state and worker liveness"
```

---

### Task 9: The Roomies page reader

The only file that knows anything about Roomies. Everything platform-specific
lives here so that a Roomies redesign touches one file and the contract is
untouched.

**Files:**
- Create on the mini: `~/.claude/tools/roomies/roomies_page.py`

- [ ] **Step 1: Write it**

```python
"""Roomies-specific page reading. The ONLY file that knows Roomies exists.

Exposes one function used by the worker: read_listing(page, url) -> observed.
It never edits anything. The apply() half of the contract is deliberately absent
until Mark retires his 9 Aug Chrome-extension-only rule for Roomies.

Selectors are guesses until run against a real logged-in listing page and
corrected. Task 10 step 3 is where they get pinned down; do not assume they are
right because they are written down.
"""
from datetime import datetime, timezone

SIGNED_OUT_MARKERS = ("log in", "sign in", "create an account")


class SessionExpired(RuntimeError):
    """Raised when the page shows a login wall rather than our listing."""


def read_listing(page, url: str) -> dict:
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(1500)

    body = page.inner_text("body")[:4000].lower()
    if any(m in body for m in SIGNED_OUT_MARKERS):
        raise SessionExpired(f"login wall at {url}")

    title_el = page.query_selector("h1")
    title = title_el.inner_text().strip() if title_el else None

    # Roomies has no availability field. A listing is live or it is not, so
    # "on" has to be read off whatever the page uses to say so.
    text = body
    is_on = "unavailable" not in text and "no longer available" not in text

    return {
        "on": is_on,
        "headline": title,
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }
```

- [ ] **Step 2: Commit it to the repo as the reference copy**

The mini runs it from `~/.claude/tools/roomies/`, but it is reviewed in git.

```bash
mkdir -p workers/roomies
cp ~/.claude/tools/roomies/roomies_page.py workers/roomies/roomies_page.py
git add workers/roomies/roomies_page.py
git commit -m "feat: Roomies page reader, the only platform-specific module"
```

---

### Task 10: The report-only worker

**Files:**
- Create on the mini: `~/.claude/tools/roomies/worker.py`

- [ ] **Step 1: Write it**

```python
"""Roomies channel worker, REPORT ONLY.

Implements the contract in docs/integrations/channel-worker-contract-v1.md.
Knows nothing about Roomies beyond importing roomies_page.

It does not write to Roomies. It claims drifting placements, reads what the
listing actually says, and reports that back. Spec section 11.
"""
import os, sys, json
import httpx
from playwright.sync_api import sync_playwright
from roomies_page import read_listing, SessionExpired

SUPABASE_URL = os.environ["SUPABASE_URL"]
WORKER_KEY   = os.environ["ROOMIES_WORKER_KEY"]
WORKER_ID    = "mini-roomies"
CHANNEL      = "roomies"
PROFILE      = os.path.expanduser("~/.claude/browser-profiles/roomies")

HEADERS = {"apikey": WORKER_KEY,
           "Authorization": f"Bearer {WORKER_KEY}",
           "Content-Type": "application/json"}


def rpc(name: str, payload: dict):
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/rpc/{name}",
                   headers=HEADERS, json=payload, timeout=20)
    r.raise_for_status()
    return r.json() if r.text else None


def main() -> int:
    rpc("fn_worker_heartbeat",
        {"p_worker_id": WORKER_ID, "p_channel_slug": CHANNEL,
         "p_note": {"mode": "report-only"}})

    work = rpc("fn_claim_listing_work",
               {"p_channel_slug": CHANNEL, "p_worker_id": WORKER_ID, "p_limit": 25}) or []

    if not work:
        print("nothing to do")
        return 0

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE, channel="chrome", headless=False, no_viewport=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            for item in work:
                item = item if isinstance(item, dict) else json.loads(item)
                try:
                    observed = read_listing(page, item["url"])
                    err = None
                except SessionExpired as e:
                    # Stop the whole run. Never retry a login, never thrash
                    # credentials. Spec section 7.
                    rpc("fn_report_listing_result",
                        {"p_placement_id": item["placement_id"],
                         "p_claim_token": item["claim_token"],
                         "p_observed": {}, "p_error": f"session expired: {e}"})
                    print(f"SESSION EXPIRED, stopping run: {e}", file=sys.stderr)
                    return 2
                except Exception as e:
                    observed, err = {}, f"{type(e).__name__}: {e}"

                res = rpc("fn_report_listing_result",
                          {"p_placement_id": item["placement_id"],
                           "p_claim_token": item["claim_token"],
                           "p_observed": observed, "p_error": err})
                print(f"{item['lazybee_ref']}: {res}")
        finally:
            ctx.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Install httpx into the mini venv**

```bash
ssh mini 'export PATH=/opt/homebrew/bin:$PATH
  cd ~/.claude/tools/roomies && . .venv/bin/activate && uv pip install httpx'
```

Expected: `httpx` in the install output.

- [ ] **Step 3: Register the worker and prove the loop with the channel still disabled**

```sql
select public.fn_worker_heartbeat('mini-roomies', 'roomies', '{"mode":"report-only"}'::jsonb);
```

Then run the worker on the mini. `roomies` is still `enabled = false`, so
`fn_claim_listing_work` must return nothing and the worker must exit cleanly.

```bash
ssh mini 'export PATH=/opt/homebrew/bin:$PATH
  cd ~/.claude/tools/roomies && . .venv/bin/activate
  SUPABASE_URL=https://diiilqpfmlxjwiaeophb.supabase.co \
  ROOMIES_WORKER_KEY=$ROOMIES_WORKER_KEY   # see "Open decision" above; no correct value until option A/B/C is chosen python worker.py'
```

Expected: `nothing to do`, exit 0. This proves the heartbeat and the kill switch
before a browser is ever opened.

- [ ] **Step 4: Confirm the heartbeat landed**

```sql
select worker_id, is_stale, channel_enabled from public.v_channel_worker_health;
```

Expected: one row, `mini-roomies`, `is_stale = false`, `channel_enabled = false`.

- [ ] **Step 5: Commit the reference copy**

```bash
cp ~/.claude/tools/roomies/worker.py workers/roomies/worker.py
git add workers/roomies/worker.py
git commit -m "feat: report-only Roomies channel worker"
```

---

### Task 11: Discovery, linking the 19 real listing ids

**Blocked until Mark logs into Roomies on the mini.** Chrome is already open on
the mini at roomies.sg with the persistent profile, waiting for him. Nothing in
this task can run before that, and no earlier task depends on it.

**Files:**
- Create on the mini: `~/.claude/tools/roomies/discover.py`

- [ ] **Step 1: Write it**

```python
"""One-off: read our own Roomies listings and record their ids.

A database write, not a platform write, so it is safe under the report-only
rule. Matching is by Lazybee reference first, because that string is on the
listing precisely so a listing can be identified from the listing alone.
Anything it cannot match confidently is printed for a human rather than guessed.
"""
import os, re, sys
import httpx
from playwright.sync_api import sync_playwright

SUPABASE_URL = os.environ["SUPABASE_URL"]
WORKER_KEY   = os.environ["ROOMIES_WORKER_KEY"]
PROFILE      = os.path.expanduser("~/.claude/browser-profiles/roomies")
REF = re.compile(r"LZB-[A-Z]{2}-[A-Z0-9]+")

HEADERS = {"apikey": WORKER_KEY, "Authorization": f"Bearer {WORKER_KEY}",
           "Content-Type": "application/json"}

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        PROFILE, channel="chrome", headless=False, no_viewport=True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://roomies.sg/my-listings", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(2500)

    cards = page.query_selector_all("a[href*='/listing/']")
    print(f"found {len(cards)} listing links")

    unmatched = []
    for c in cards:
        href = c.get_attribute("href") or ""
        text = c.inner_text()
        m = REF.search(text)
        if not m:
            unmatched.append((href, text[:80].replace("\n", " ")))
            continue
        unit = m.group(0).removeprefix("LZB-")
        listing_id = href.rstrip("/").split("/")[-1]
        r = httpx.post(f"{SUPABASE_URL}/rest/v1/rpc/fn_link_placement",
                       headers=HEADERS, timeout=20,
                       json={"p_channel_slug": "roomies", "p_unit_code": unit,
                             "p_external_id": listing_id,
                             "p_url": f"https://roomies.sg{href}"})
        print(unit, listing_id, r.status_code, r.text[:120])

    ctx.close()

if unmatched:
    print("\nNOT MATCHED, needs a human:", file=sys.stderr)
    for href, text in unmatched:
        print(f"  {href}  {text}", file=sys.stderr)
```

- [ ] **Step 2: Fix the selectors against the real page**

The selectors above (`a[href*='/listing/']`, `/my-listings`) are guesses. Open
the logged-in listings page on the mini, read the real markup, and correct both
this file and `roomies_page.py` before trusting either. Do not skip this: a
selector that silently matches nothing looks identical to having no listings.

- [ ] **Step 3: Run it**

```bash
ssh mini 'export PATH=/opt/homebrew/bin:$PATH
  cd ~/.claude/tools/roomies && . .venv/bin/activate
  SUPABASE_URL=https://diiilqpfmlxjwiaeophb.supabase.co \
  ROOMIES_WORKER_KEY=$ROOMIES_WORKER_KEY   # see "Open decision" above; no correct value until option A/B/C is chosen python discover.py'
```

- [ ] **Step 4: Verify what landed, and be honest about what did not**

```sql
select count(*) as linked,
       count(*) filter (where external_id is null) as missing_id
  from public.listing_placements lp
  join public.listing_channels c on c.id = lp.channel_id and c.slug = 'roomies';
```

Expected: `linked` equals the number of listings that actually exist on Roomies,
which may not be 19. Report the real number rather than assuming the CLAUDE.md
claim of 19 mapped listings is still true; `listing_placements` was empty as of
2026-08-09, so that mapping does not exist in the database.

- [ ] **Step 5: Commit**

```bash
cp ~/.claude/tools/roomies/discover.py workers/roomies/discover.py
git add workers/roomies/discover.py
git commit -m "feat: Roomies listing discovery, links external ids by Lazybee ref"
```

---

### Task 12: Scheduled run and the wake signal

**Files:**
- Create on the mini: `~/Library/LaunchAgents/com.markwee.roomies.worker.plist`

- [ ] **Step 1: Write the launchd job**

Twice daily, not every minute. The volume is a few dozen edits a year, and a
sweep is the backstop, not the mechanism.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.markwee.roomies.worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>cd $HOME/.claude/tools/roomies &amp;&amp; . .venv/bin/activate &amp;&amp; python worker.py</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SUPABASE_URL</key><string>https://diiilqpfmlxjwiaeophb.supabase.co</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>15</integer></dict>
    <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>15</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/Users/mark/.claude/tools/roomies/run.log</string>
  <key>StandardErrorPath</key><string>/Users/mark/.claude/tools/roomies/run.err</string>
  <key>WorkingDirectory</key><string>/Users/mark/.claude/tools/roomies</string>
</dict>
</plist>
```

`ROOMIES_WORKER_KEY` is deliberately not in the plist. Put it in
`~/.chudlife/secrets.env` and source it from the command, matching how
`com.markwee.chudlife.telegram-router` already does it on this machine.

- [ ] **Step 2: Load it and force one run**

```bash
ssh mini 'launchctl unload ~/Library/LaunchAgents/com.markwee.roomies.worker.plist 2>/dev/null
  launchctl load ~/Library/LaunchAgents/com.markwee.roomies.worker.plist
  launchctl start com.markwee.roomies.worker
  sleep 20
  tail -5 ~/.claude/tools/roomies/run.log ~/.claude/tools/roomies/run.err'
```

Expected: `nothing to do` in `run.log` while the channel is disabled.

- [ ] **Step 3: Check for the two known launchd traps before declaring it working**

Both have bitten this machine before. A job that exits 0 doing nothing looks
identical to a job that worked.

```bash
ssh mini 'launchctl list | grep roomies'
```

Expected: exit status `0`. An exit status of `127` means the script path is
inside a TCC-protected directory such as Desktop; move it. Confirm the heartbeat
actually advanced rather than trusting the exit code:

```sql
select worker_id, last_seen_at, (now() - last_seen_at) < interval '2 minutes' as just_ran
  from public.v_channel_worker_health where worker_id = 'mini-roomies';
```

Expected: `just_ran = true`.

- [ ] **Step 4: Commit the reference copy**

```bash
cp ~/Library/LaunchAgents/com.markwee.roomies.worker.plist workers/roomies/com.markwee.roomies.worker.plist
git add workers/roomies/com.markwee.roomies.worker.plist
git commit -m "chore: launchd schedule for the Roomies worker"
```

---

## What is deliberately not built here

Recorded so the next person does not assume it was forgotten.

| Not built | Why | Where it goes |
| --- | --- | --- |
| Supabase Realtime subscription | The twice-daily sweep is sufficient at a few dozen changes a year. Realtime is a latency optimisation, and adding a long-lived socket to a machine that sleeps is a new failure mode for no current benefit. | Follow-up, if latency ever matters |
| The apply path (editing Roomies) | Mark's Chrome-extension-only rule of 9 Aug 2026 stands until he retires it | Follow-up plan |
| The Approve button in the portal | Pointless until there is an off-push to approve | Follow-up plan, with the apply path |
| Telegram nudges | Token is absent on both machines as of 2026-08-09, and approval works from the portal without it | Blocked on Mark restoring the token |
| Pointing `hyve-booking` at `fn_room_next_available` | Different repo, needs its own approval, and is the real fix for the 3 disputed rooms | Its own plan |

## Definition of done

1. `node --test src/lib/listingDrift.test.js` passes, 7 tests.
2. Both views return `anon_can_select = false`.
3. `fn_claim_listing_work` returns zero rows while `roomies.enabled = false`, and rejects an unregistered worker.
4. The mini runs the worker on a schedule and `v_channel_worker_health` shows a fresh heartbeat.
5. The Availability tab shows all 19 rooms with observed state, and `IH-PR1`, `IH-STD2`, `TG-PR3` sorted to the top as disputed.
6. Nothing has been written to Roomies.
