-- 20260821000001_leads_date_initiated.sql
--
-- leads.date_initiated exists in production but in no migration: it was added
-- by hand. Three portal files write and read it (useLeads.addLead, LeadCard,
-- LeadDrawer), so a fresh environment rebuilt from this repo would accept the
-- Add Lead form and then fail the insert. Additive and idempotent: the live
-- database already has the column and will no-op.

alter table public.leads
  add column if not exists date_initiated date;

comment on column public.leads.date_initiated is
  'Date the portal operator first made contact. Written by the Add Lead form.';
