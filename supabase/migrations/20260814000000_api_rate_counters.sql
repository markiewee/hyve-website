-- Atomic per-key rate counting for the Partner API.
--
-- The v1 limiter counted api_request_log rows BEFORE the current request's
-- row landed, so N concurrent requests all read the same low count and all
-- passed (proven live 11 Aug: 75 concurrent pings, 75 x HTTP 200). This
-- replaces the read-then-check with one INSERT .. ON CONFLICT .. RETURNING:
-- every request atomically claims a slot number in its minute window and the
-- application compares that number against the key's limit.

create table if not exists api_rate_counters (
  key_id uuid not null references channel_api_keys(id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key_id, window_start)
);

-- Service-role only, same posture as api_request_log: RLS on, no policies.
alter table api_rate_counters enable row level security;

create or replace function fn_rate_bump(p_key_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into api_rate_counters (key_id, window_start, count)
  values (p_key_id, date_trunc('minute', now()), 1)
  on conflict (key_id, window_start)
  do update set count = api_rate_counters.count + 1
  returning count;
$$;

revoke execute on function fn_rate_bump(uuid) from public, anon, authenticated;

-- Windows are worthless ten minutes later; sweep hourly so the table stays
-- a few hundred rows at most.
do $$
begin
  perform cron.unschedule('partner-rate-prune');
exception when others then null;
end $$;

do $$
begin
  perform cron.schedule('partner-rate-prune', '7 * * * *', $q$
    delete from api_rate_counters where window_start < now() - interval '10 minutes'
  $q$);
end $$;
