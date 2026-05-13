-- supabase/migrations/20260513000000_leads_pipeline_extend.sql
-- Extend existing public.leads table for hyve-reply-monitor pipeline.
-- Idempotent: safe to re-run.

alter table public.leads
  add column if not exists chat_id text,
  add column if not exists intent jsonb not null default '{}'::jsonb,
  add column if not exists matched_room_codes text[] not null default '{}',
  add column if not exists status_changed_at timestamptz,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_reply_at timestamptz,
  add column if not exists last_message_excerpt text,
  add column if not exists owner text not null default 'mark';

-- Backfill status_changed_at for pre-existing rows
update public.leads
   set status_changed_at = coalesce(status_changed_at, updated_at, created_at)
 where status_changed_at is null;

-- Indexes
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_last_message_at_idx on public.leads (last_message_at desc);
create unique index if not exists leads_chat_id_uniq
  on public.leads (chat_id)
  where chat_id is not null;

-- Widen status CHECK constraint to include new pipeline values.
-- Existing values preserved as back-compat aliases: 'viewed', 'closed_won', 'closed_lost'.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status = any (array[
    'new',
    'qualified',
    'viewing_booked',
    'viewed',           -- legacy alias used by AdminViewingsPage/useAdminInbox
    'viewing_done',
    'agreement_sent',
    'signed',
    'closed_won',       -- legacy alias for signed
    'lost',
    'closed_lost',      -- legacy alias for lost
    'cold'
  ]));

-- Enable Realtime publication (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
end $$;
