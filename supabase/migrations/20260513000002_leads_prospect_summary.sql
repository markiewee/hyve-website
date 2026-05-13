-- supabase/migrations/20260513000002_leads_prospect_summary.sql
-- Add prospect_summary column for the AI-gleaned 1-2 sentence brief
-- shown on Kanban cards. Editable by admins for refinement.

alter table public.leads
  add column if not exists prospect_summary text;
