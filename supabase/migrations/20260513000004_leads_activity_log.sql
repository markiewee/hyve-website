-- supabase/migrations/20260513000004_leads_activity_log.sql
-- Add activity_log jsonb to leads — append-only timeline of every action.
-- Entries: { type, actor, when, ...payload }
--
-- Common types:
--   booking_link_sent          — lazybee.sg/book CTA delivered
--   booking_form_submitted     — prospect filled booking form, slot proposed
--   reply_sent                 — text reply delivered via Beeper
--   photos_sent                — room photos delivered via Beeper /v1/assets
--   bump_sent                  — follow-up nudge fired by bump engine
--   door_opener_ack            — resident/captain acked door-opener role
--   shower_ack                 — resident/captain acked shower role
--   reschedule_proposed        — host can't do prospect's slot, alternates offered
--   slot_rescheduled           — prospect agreed to a new slot
--   virtual_viewing_arranged   — last-resort fallback, Mark + code + video
--   viewing_host_pending       — neither role secured yet, chasing
--   viewing_booked             — slot confirmed to prospect
--   manual_note                — Mark typed a note in the drawer

alter table public.leads
  add column if not exists activity_log jsonb not null default '[]'::jsonb;

create index if not exists leads_activity_log_idx on public.leads using gin (activity_log);

-- Also promote the chat_id partial unique index to a real unique constraint
-- so ON CONFLICT (chat_id) upserts work for the skill's upsert-lead helper.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_chat_id_unique'
  ) then
    -- drop the partial unique INDEX (if exists), then add a real constraint
    if exists (select 1 from pg_indexes where indexname = 'leads_chat_id_uniq') then
      drop index public.leads_chat_id_uniq;
    end if;
    alter table public.leads add constraint leads_chat_id_unique unique (chat_id);
  end if;
end $$;
