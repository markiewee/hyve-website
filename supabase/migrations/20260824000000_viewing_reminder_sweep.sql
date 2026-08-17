-- The day-before viewing reminder stopped sending on 17 Jul 2026.
--
-- It was triggered by a Vercel cron on /api/booking/cron. Vercel crons hit the
-- deployment URL, and this project's deployment URLs sit behind SSO
-- (ssoProtection.deploymentType = prod_deployment_urls_and_all_previews), so
-- that request now 302s to vercel.com/sso-api and never reaches the handler.
-- The route itself is healthy: www.lazybee.sg/api/booking/cron still answers
-- 403 from its own auth gate. Nobody noticed for a month because the only
-- signal of failure was an email that did not arrive. Wei Wee's 15 Aug viewing
-- sat squarely inside the window and she was told nothing.
--
-- pg_cron already runs twelve jobs on this project and is the most reliable
-- scheduler we have, so the sweep moves here. Same window the Vercel handler
-- used, and the edge function still owns stamping reminder_24h_sent_at, so a
-- send that fails is retried on the next run instead of being marked done.

create or replace function public.fn_viewing_reminder_sweep()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  n integer := 0;
begin
  for v in
    select id
      from public.property_viewings
     where status = 'confirmed'
       and reminder_24h_sent_at is null
       and slot_start >= now() + interval '12 hours'
       and slot_start <= now() + interval '36 hours'
  loop
    -- Fire and forget. pg_net queues it, so a slow edge function cannot hold
    -- the cron worker open or roll anything back.
    perform net.http_post(
      url     := 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/viewing-notify',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (
                     select decrypted_secret from vault.decrypted_secrets
                      where name = 'SERVICE_ROLE_KEY')),
      body    := jsonb_build_object(
                   'event', 'viewing-reminder-24h',
                   'viewing_id', v.id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.unschedule('viewing-reminder-24h')
 where exists (select 1 from cron.job where jobname = 'viewing-reminder-24h');

-- 12:00 UTC is 20:00 Singapore, the evening before, which is what the email
-- itself says. Every slot falls inside exactly one run's 12 to 36 hour window,
-- so nobody is reminded twice and nobody is missed.
select cron.schedule(
  'viewing-reminder-24h',
  '0 12 * * *',
  $cron$ select public.fn_viewing_reminder_sweep(); $cron$
);
