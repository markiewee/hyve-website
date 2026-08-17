-- Tenancy reference numbers + licence period, filled at the database.
--
-- onboarding_progress is written by three separate places: api/portal/claim-reserve.js
-- (self-serve booking), AdminOnboardingPage.jsx (admin invite) and
-- AdminOnboardingDetailPage.jsx (admin edit). Only the last two ever set ref_number and
-- licence_period, so every prospect who booked themselves landed with both null, and the
-- generated licence agreement printed a literal "[REF_NUMBER]" where {{REF_NUMBER}} sits
-- in public/templates/licence-agreement.html. Filling them in a BEFORE trigger covers
-- every writer at once and keeps serial allocation atomic.

-- 1. One counter per property prefix per year.
create table if not exists public.tenancy_ref_counters (
  prefix      text not null,
  year        int  not null,
  last_serial int  not null default 0,
  primary key (prefix, year)
);

alter table public.tenancy_ref_counters enable row level security;
-- Deliberately no policies: only the service role and the security-definer
-- allocator below ever touch this table.

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

-- 3. Calendar-month span, identical to the arithmetic AdminOnboardingPage.jsx already
--    uses, so the admin screen and the database never state a different length for the
--    same tenancy.
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

-- 6. Backfill every row that has no ref, oldest tenancy first so the serials read in
--    chronological order. The same UPDATE fires the trigger, which fills licence_period
--    for those rows too.
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
