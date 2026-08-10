-- Rent matching: the review queue for credits the system is not sure about.
--
-- verify-rent settles a credit on its own only when the evidence is
-- unambiguous: the tenant quoted their payment_ref, or their name and the
-- exact amount owed both agree and nothing else competes. Everything weaker
-- lands here as a proposal for a human, because auto-closing the wrong row
-- credits one tenant's money to another and then chases the tenant who
-- actually paid.
--
-- Amount alone is never sufficient, and that is measured: on this database
-- 13 of 24 distinct rent amounts are shared by more than one row.

begin;

create table if not exists public.rent_match_proposals (
  id                      uuid primary key default gen_random_uuid(),

  -- The credit, captured verbatim so the queue still makes sense months later
  -- even if Aspire's history moves out of the fetch window.
  aspire_id               text not null,
  credit_date             date not null,
  credit_amount           numeric(12,2) not null,
  counterparty            text,
  credit_reference        text,

  -- The best guess, and what else was close. Null row means we found nothing
  -- worth proposing and this is money we cannot attribute at all.
  proposed_rent_payment_id uuid references public.rent_payments(id) on delete set null,
  confidence              numeric(3,2) not null default 0,
  reason                  text not null,
  alternatives            jsonb not null default '[]'::jsonb,

  status                  text not null default 'PENDING'
                          check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  decided_by              text,
  decided_at              timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One proposal per bank credit, ever. The verification cron runs every 30
-- minutes over a 45-day window, so without this the queue would refill with
-- the same credits 48 times a day.
create unique index if not exists rent_match_proposals_aspire_id_key
  on public.rent_match_proposals (aspire_id);

create index if not exists rent_match_proposals_pending_idx
  on public.rent_match_proposals (status, credit_date desc)
  where status = 'PENDING';

comment on table public.rent_match_proposals is
  'Bank credits the matcher could not settle confidently. A human queue: real '
  'money that arrived and has not been attributed to a tenant yet.';

comment on column public.rent_match_proposals.alternatives is
  'Other rent rows that fit nearly as well. Present precisely when the reason '
  'for not auto-closing is that more than one candidate was plausible.';

drop trigger if exists trg_rent_match_proposals_updated_at on public.rent_match_proposals;
create trigger trg_rent_match_proposals_updated_at
  before update on public.rent_match_proposals
  for each row execute function public.update_updated_at();

alter table public.rent_match_proposals enable row level security;

-- Admins only: this holds counterparty names and amounts.
drop policy if exists "Admin manage match proposals" on public.rent_match_proposals;
create policy "Admin manage match proposals"
  on public.rent_match_proposals for all
  using (
    exists (
      select 1 from public.tenant_profiles tp
       where tp.user_id = auth.uid()
         and tp.role = any (array['ADMIN', 'SUPER_ADMIN'])
         and tp.is_active = true
    )
  );

commit;
