-- Channel worker contract v1, part 2: the API.
-- Spec: docs/integrations/channel-worker-contract-v1.md sections 4 and 7.
--
-- All four functions are security definer and all begin by checking the caller
-- named a worker registered to the channel it claims. Under the service-role
-- credential Mark chose on 2026-08-09 that check is redundant; it stays because
-- it costs nothing and it means tightening the credential later is a change to
-- authentication alone. See the plan, "Worker credential".

begin;

create or replace function public.fn_worker_heartbeat(
  p_worker_id    text,
  p_channel_slug text,
  p_note         jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or p_channel_slug is null then
    raise exception 'worker_id and channel_slug are required';
  end if;

  if not exists (select 1 from public.listing_channels where slug = p_channel_slug) then
    raise exception 'unknown channel %', p_channel_slug;
  end if;

  insert into public.channel_workers (worker_id, channel_slug, last_seen_at, note)
  values (p_worker_id, p_channel_slug, now(), p_note)
  on conflict (worker_id) do update
    set last_seen_at = now(),
        note         = coalesce(excluded.note, public.channel_workers.note),
        channel_slug = excluded.channel_slug;
end;
$$;

comment on function public.fn_worker_heartbeat is
  'Called every run and on a timer regardless of whether there was work. '
  'Silence and success are otherwise indistinguishable. Spec section 4.3.';

commit;
