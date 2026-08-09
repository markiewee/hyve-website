-- Rent pipeline: submitted -> verified -> paid
--
-- Rent is currently marked PAID by an admin clicking a bank transaction next to a
-- rent row. Nothing checks the amount, nothing records who verified it, and the
-- "never mark paid without seeing money" rule exists only as a comment in
-- AdminRentPage.jsx and is contradicted by dead code in the same file.
--
-- This migration makes that rule a database constraint and gives rent a payment
-- reference so a bank credit can be matched deterministically instead of by
-- guessing at amounts and counterparty names.

begin;

-- ---------------------------------------------------------------------------
-- 1. Verification columns on rent_payments
-- ---------------------------------------------------------------------------

alter table public.rent_payments
  add column if not exists payment_ref         text,
  add column if not exists verified_at         timestamptz,
  add column if not exists verified_by         text,
  add column if not exists verification_source text;

comment on column public.rent_payments.payment_ref is
  'Reference we ask the tenant to quote in their PayNow transfer, e.g. LB-CPPR3-2608. Makes bank matching deterministic.';
comment on column public.rent_payments.verification_source is
  'How the money was confirmed: ASPIRE (bank credit), STRIPE (card), or MANUAL (offset/reimbursement, requires a stated reason).';

-- ---------------------------------------------------------------------------
-- 2. SUBMITTED status
--    PENDING -> SUBMITTED (tenant says they paid) -> PAID (money actually seen)
-- ---------------------------------------------------------------------------

alter table public.rent_payments drop constraint if exists rent_payments_status_check;
alter table public.rent_payments add constraint rent_payments_status_check
  check (status = any (array['PENDING','SUBMITTED','PAID','OVERDUE','PARTIAL']));

alter table public.rent_payments drop constraint if exists rent_payments_verification_source_check;
alter table public.rent_payments add constraint rent_payments_verification_source_check
  check (verification_source is null
         or verification_source = any (array['ASPIRE','STRIPE','MANUAL']));

-- ---------------------------------------------------------------------------
-- 3. Payment reference: backfill existing rows, then enforce uniqueness
--    Format LB-<unit code without hyphens>-<YYMM>, e.g. LB-CPPR3-2608.
-- ---------------------------------------------------------------------------

update public.rent_payments rp
set payment_ref = 'LB-' || upper(replace(coalesce(r.unit_code, 'UNK'), '-', ''))
                || '-' || to_char(rp.month, 'YYMM')
from public.rooms r
where r.id = rp.room_id
  and rp.payment_ref is null;

-- Any row whose room went missing still needs a reference.
update public.rent_payments
set payment_ref = 'LB-UNK-' || to_char(month, 'YYMM') || '-' || left(id::text, 4)
where payment_ref is null;

-- A tenant could in principle share a unit_code+month with a roommate row, so
-- disambiguate rather than letting the unique index fail.
with dupes as (
  select id, payment_ref,
         row_number() over (partition by payment_ref order by created_at, id) as rn
  from public.rent_payments
)
update public.rent_payments rp
set payment_ref = rp.payment_ref || '-' || d.rn
from dupes d
where d.id = rp.id and d.rn > 1;

create unique index if not exists rent_payments_payment_ref_key
  on public.rent_payments (payment_ref);

-- ---------------------------------------------------------------------------
-- 4. The money control, moved from a code comment into a constraint
--
--    A row may only enter PAID if we can say how the money was confirmed.
--    ASPIRE/STRIPE need a payment_reference. MANUAL needs a named person and a
--    written reason, which covers the real cases already in the ledger
--    (DEPOSIT offset, MARK_REIMBURSE, AIRBNB, OTHER).
--
--    Only fires on the transition INTO PAID, so the 85 historical PAID rows
--    with no reference are not disturbed by unrelated updates.
-- ---------------------------------------------------------------------------

create or replace function public.fn_rent_payment_verify_guard()
returns trigger
language plpgsql
as $$
declare
  entering_paid        boolean;
  verification_changed boolean;
begin
  entering_paid := new.status = 'PAID'
                   and (tg_op = 'INSERT' or old.status is distinct from 'PAID');

  -- Also guard an already-PAID row whose verification is being altered,
  -- otherwise the reference or source could be stripped after the fact and the
  -- control would only hold on the way in.
  verification_changed := tg_op = 'UPDATE'
                          and new.status = 'PAID' and old.status = 'PAID'
                          and (new.payment_reference  is distinct from old.payment_reference
                            or new.verification_source is distinct from old.verification_source
                            or new.verified_by         is distinct from old.verified_by);

  if entering_paid or verification_changed then

    -- Infer the source when the caller did not say, so the existing admin
    -- match flow (which supplies a bank reference) keeps working unchanged.
    if new.verification_source is null then
      if new.payment_reference is not null then
        new.verification_source := 'ASPIRE';
      else
        raise exception using
          errcode = 'check_violation',
          message = 'rent_payments: cannot set PAID without a payment_reference, or an explicit MANUAL verification_source with verified_by and a reason in notes',
          hint    = 'Match a real bank credit, or set verification_source=MANUAL with verified_by and notes.';
      end if;
    end if;

    if new.verification_source in ('ASPIRE','STRIPE')
       and new.payment_reference is null then
      raise exception using
        errcode = 'check_violation',
        message = format('rent_payments: %s verification requires a payment_reference', new.verification_source);
    end if;

    if new.verification_source = 'MANUAL'
       and (new.verified_by is null or coalesce(btrim(new.notes), '') = '') then
      raise exception using
        errcode = 'check_violation',
        message = 'rent_payments: MANUAL verification requires verified_by and a reason in notes';
    end if;

    if new.verified_at is null then
      new.verified_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rent_payment_verify_guard on public.rent_payments;
create trigger trg_rent_payment_verify_guard
  before insert or update on public.rent_payments
  for each row execute function public.fn_rent_payment_verify_guard();

-- ---------------------------------------------------------------------------
-- 5. payment_submissions
--
--    Submissions live in a child table for two reasons. rent_payments has
--    UNIQUE(tenant_profile_id, month) so instalments cannot be extra rows, and
--    the admin regenerate handler DELETEs every PENDING row for the month,
--    which would otherwise destroy a tenant's uploaded proof.
--
--    The FK is ON DELETE RESTRICT deliberately: a regenerate that would wipe a
--    real submission should fail loudly rather than silently lose it.
-- ---------------------------------------------------------------------------

create table if not exists public.payment_submissions (
  id                     uuid primary key default gen_random_uuid(),
  rent_payment_id        uuid not null references public.rent_payments(id) on delete restrict,
  tenant_profile_id      uuid not null references public.tenant_profiles(id) on delete cascade,
  amount                 numeric,
  method                 text not null
                           check (method = any (array['PAYNOW','BANK_TRANSFER','STRIPE','OTHER'])),
  reference_quoted       text,
  proof_url              text,
  status                 text not null default 'PENDING'
                           check (status = any (array['PENDING','MATCHED','REJECTED'])),
  matched_transaction_ref text,
  submitted_at           timestamptz not null default now(),
  reviewed_at            timestamptz,
  reviewed_by            text,
  review_note            text,
  created_at             timestamptz not null default now()
);

create index if not exists payment_submissions_rent_payment_id_idx
  on public.payment_submissions (rent_payment_id);
create index if not exists payment_submissions_status_idx
  on public.payment_submissions (status) where status = 'PENDING';

alter table public.payment_submissions enable row level security;

drop policy if exists payment_submissions_admin_all on public.payment_submissions;
create policy payment_submissions_admin_all
  on public.payment_submissions for all
  using      (get_user_role(auth.uid()) = any (array['ADMIN','SUPER_ADMIN']))
  with check (get_user_role(auth.uid()) = any (array['ADMIN','SUPER_ADMIN']));

drop policy if exists payment_submissions_tenant_read_own on public.payment_submissions;
create policy payment_submissions_tenant_read_own
  on public.payment_submissions for select
  using (tenant_profile_id in (
           select tenant_profiles.id from public.tenant_profiles
           where tenant_profiles.user_id = auth.uid()));

-- The tenant write path that does not exist today: rent_payments grants tenants
-- SELECT only, so there is currently no way for a tenant to tell us they paid.
drop policy if exists payment_submissions_tenant_insert_own on public.payment_submissions;
create policy payment_submissions_tenant_insert_own
  on public.payment_submissions for insert
  with check (tenant_profile_id in (
                select tenant_profiles.id from public.tenant_profiles
                where tenant_profiles.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Latent bug: the rent admin policy omits SUPER_ADMIN, unlike every other
--    table, so a SUPER_ADMIN cannot write rent. Bring it in line.
-- ---------------------------------------------------------------------------

drop policy if exists "Admin full access rent" on public.rent_payments;
create policy "Admin full access rent"
  on public.rent_payments for all
  using      (get_user_role(auth.uid()) = any (array['ADMIN','SUPER_ADMIN']))
  with check (get_user_role(auth.uid()) = any (array['ADMIN','SUPER_ADMIN']));

commit;
