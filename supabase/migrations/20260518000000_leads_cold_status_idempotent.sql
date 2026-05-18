-- supabase/migrations/20260518000000_leads_cold_status_idempotent.sql
-- Re-assert the leads.status CHECK constraint to make 'cold' a first-class
-- status value. Idempotent: prod already includes 'cold' (added in
-- 20260513000000_leads_pipeline_extend.sql), so this migration is a no-op
-- there. It exists so dev/staging/new envs that may have drifted get the
-- same constraint, and to document the cold-as-non-archive promotion.
--
-- Semantics change in this release:
--   * 'cold' is now treated as an ACTIVE Kanban column (parking lane for
--     silent leads), NOT an archived final state. The frontend
--     (useLeads.js + AdminLeadsPage.jsx) reflects this — the DB schema
--     itself doesn't need to change since status is a free-form TEXT
--     with a CHECK constraint.
--
-- Safe to re-run.

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
    'cold'              -- promoted to active board 2026-05-18
  ]));

-- Index to help the "cold and stale > N days" filter the LeadCard renders.
-- last_message_at is already indexed (leads_last_message_at_idx); this is a
-- partial index just for cold rows so the active-board filter is cheap.
create index if not exists leads_cold_last_message_at_idx
  on public.leads (last_message_at desc)
  where status = 'cold';

-- No data backfill needed — 'cold' rows continue to exist with the same
-- status string they had before this migration.
