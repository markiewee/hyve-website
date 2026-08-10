-- Partner webhook plumbing. Changes enqueue deliveries synchronously in the
-- trigger (cheap inserts that no-op when nobody subscribes), then a minutely
-- pg_cron sweep delivers PENDING rows through the API's dispatch route and
-- doubles as the retry mechanism. A daily job prunes old rows.
--
-- The dispatch secret follows the rent_crons_support pattern: it lives in the
-- vault and is read AT RUN TIME, so no credential is stored in
-- cron.job.command. Requires, once, out of band and NOT in this file:
--
--   select vault.create_secret('<value>', 'PARTNER_DISPATCH_SECRET');
--
-- The same value goes into Vercel env as PARTNER_DISPATCH_SECRET.

begin;

-- Fan out one delivery row per active subscription that wants this event.
-- Payloads carry pointers, never contents: the partner re-reads the API,
-- which applies all the whitelisting in one place.
create or replace function public.fn_partner_enqueue_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_payload jsonb;
  v_channel_filter uuid := null;
begin
  v_event := case tg_table_name
    when 'room_calendar'    then 'listing.calendar.updated'
    when 'listing_channels' then 'listing.rates.updated'
    when 'rooms'            then 'listing.rates.updated'
    when 'listing_profiles' then 'listing.profile.updated'
    when 'booking_requests' then 'booking_request.updated'
  end;
  if v_event is null then return null; end if;

  v_payload := jsonb_build_object(
    'table', tg_table_name,
    'change', lower(tg_op),
    'occurred_at', now()
  );
  -- Field access stays inside per-table branches: a record reference to a
  -- column the row type does not have fails at plan time, even when no
  -- subscription rows exist, and takes the caller's write down with it.
  if tg_table_name = 'room_calendar' then
    if tg_op = 'DELETE' then
      v_payload := v_payload || jsonb_build_object('room_id', old.room_id);
    else
      v_payload := v_payload || jsonb_build_object('room_id', new.room_id);
    end if;
  elsif tg_table_name = 'booking_requests' then
    if tg_op = 'DELETE' then
      v_payload := v_payload || jsonb_build_object('booking_request_id', old.id);
      v_channel_filter := old.channel_id;
    else
      v_payload := v_payload || jsonb_build_object('booking_request_id', new.id);
      v_channel_filter := new.channel_id;
    end if;
  end if;

  insert into public.webhook_deliveries (subscription_id, event_type, payload)
  select s.id, v_event, v_payload
  from public.webhook_subscriptions s
  where s.active
    and v_event = any(s.events)
    -- booking_request events go only to the channel that owns the request
    and (v_channel_filter is null or s.channel_id = v_channel_filter);

  return null;
end;
$$;

comment on function public.fn_partner_enqueue_event is
  'Enqueues partner webhook deliveries for a change. Pointer payloads only; '
  'the partner re-reads the API, where output whitelisting lives.';

drop trigger if exists trg_partner_events_calendar on public.room_calendar;
create trigger trg_partner_events_calendar
  after insert or update or delete on public.room_calendar
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_profiles on public.listing_profiles;
create trigger trg_partner_events_profiles
  after insert or update on public.listing_profiles
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_channels on public.listing_channels;
create trigger trg_partner_events_channels
  after update on public.listing_channels
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_rooms on public.rooms;
create trigger trg_partner_events_rooms
  after update of price_monthly on public.rooms
  for each row execute function public.fn_partner_enqueue_event();

drop trigger if exists trg_partner_events_requests on public.booking_requests;
create trigger trg_partner_events_requests
  after update of status on public.booking_requests
  for each row execute function public.fn_partner_enqueue_event();

-- ── Schedules ───────────────────────────────────────────────────────────────
-- Same run-time vault read as fn_schedule_rent_cron; different target (the
-- Vercel API dispatch route, not an edge function) and a custom header.

create or replace function public.fn_schedule_partner_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cron.unschedule('partner-webhook-dispatch')
    where exists (select 1 from cron.job where jobname = 'partner-webhook-dispatch');

  perform cron.schedule('partner-webhook-dispatch', '* * * * *', $q$
    select net.http_post(
      url := 'https://lazybee.sg/api/v1/internal/dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Dispatch-Secret', (
          select decrypted_secret from vault.decrypted_secrets
           where name = 'PARTNER_DISPATCH_SECRET')),
      body := '{}'::jsonb)
  $q$);

  perform cron.unschedule('partner-webhook-prune')
    where exists (select 1 from cron.job where jobname = 'partner-webhook-prune');

  perform cron.schedule('partner-webhook-prune', '10 17 * * *', $q$
    delete from public.webhook_deliveries where created_at < now() - interval '30 days';
    delete from public.api_request_log     where created_at < now() - interval '90 days';
  $q$);
end;
$$;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'PARTNER_DISPATCH_SECRET') then
    raise warning 'PARTNER_DISPATCH_SECRET not in vault: partner webhook crons NOT scheduled. '
                  'Run select vault.create_secret(''<value>'', ''PARTNER_DISPATCH_SECRET''); '
                  'then select public.fn_schedule_partner_dispatch();';
    return;
  end if;
  perform public.fn_schedule_partner_dispatch();
end;
$$;

commit;
