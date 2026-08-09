-- Lazybee → Millia outbound delivery wiring (completes the v1 handshake).
--
-- Two pieces that were missing (functions were deployed, but nothing triggered
-- them):
--   (1) DB trigger: maintenance_tickets INSERT/UPDATE → ticket-outbound-enqueue.
--       Only fires on locally-sourced writes (echo prevention — partner_inbound
--       writes must never re-emit).
--   (2) pg_cron */1: run partner-outbound-worker every minute to ship queued
--       rows from partner_outbound_queue.
--
-- Both edge functions are deployed with --no-verify-jwt. The PUBLIC anon key is
-- passed as Authorization purely for gateway routing — it is shipped in the
-- frontend bundle already and is NOT a secret. The real partner secrets live in
-- the edge-function vault (PARTNER_LAZYBEE_*), never here.
--
-- Spec: docs/integrations/millia-handshake-v1.md (v1).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- (1) Outbound enqueue trigger
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_ticket_to_partner()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  perform net.http_post(
    url     := 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/ticket-outbound-enqueue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpaWlscXBmbWx4andpYWVvcGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTU5NjMsImV4cCI6MjA4OTYzMTk2M30.ZISqWOMKlrOY7TIgBcJtI1nD1AJ1f350zZex099sRf8'
    ),
    body    := jsonb_build_object(
      'type',       TG_OP,
      'table',      TG_TABLE_NAME,
      'schema',     TG_TABLE_SCHEMA,
      'record',     to_jsonb(NEW),
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_enqueue_ticket_to_partner on public.maintenance_tickets;

-- WHEN clause is a belt-and-braces echo guard: never even call the function for
-- partner-sourced writes. The function ALSO filters on last_sync_source='local'.
create trigger trg_enqueue_ticket_to_partner
  after insert or update on public.maintenance_tickets
  for each row
  when (NEW.last_sync_source = 'local')
  execute function public.enqueue_ticket_to_partner();

-- ---------------------------------------------------------------------------
-- (2) Worker cron — every minute
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'partner-outbound-worker') then
    perform cron.unschedule('partner-outbound-worker');
  end if;
end $$;

select cron.schedule(
  'partner-outbound-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url     := 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/partner-outbound-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpaWlscXBmbWx4andpYWVvcGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTU5NjMsImV4cCI6MjA4OTYzMTk2M30.ZISqWOMKlrOY7TIgBcJtI1nD1AJ1f350zZex099sRf8'
      )
    );
  $job$
);
