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

-- ── Claim work ──────────────────────────────────────────────────────────────
begin;

create or replace function public.fn_claim_listing_work(
  p_channel_slug text,
  p_worker_id    text,
  p_limit        integer default 25
)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_ttl        interval := interval '5 minutes';
begin
  -- Registration check. Same first move in all four functions.
  if not exists (
    select 1 from public.channel_workers
     where worker_id = p_worker_id and channel_slug = p_channel_slug
  ) then
    raise exception 'worker % is not registered for channel %', p_worker_id, p_channel_slug;
  end if;

  -- A disabled channel is the kill switch. One field, no deploy. Reporting
  -- continues elsewhere; claiming stops dead.
  select id into v_channel_id
    from public.listing_channels
   where slug = p_channel_slug and enabled = true;

  if v_channel_id is null then
    return;   -- no rows. Not an error: "nothing to do" is the honest answer.
  end if;

  return query
  with candidate as (
    select lp.id
      from public.listing_placements lp
      join public.rooms r on r.id = lp.room_id
     where lp.channel_id = v_channel_id
       and r.room_type is not null
       -- Never claim what someone else holds.
       and (lp.claim_expires_at is null or lp.claim_expires_at < now())
       -- A placement with no external id has nothing to act on. Spec section 10.
       and lp.external_id is not null
       -- Frozen after repeated failure or a runaway loop. Needs a human.
       and lp.frozen_reason is null
       and lp.consecutive_failures < 5
       -- Daily push cap. Protects the platform account from looking like an attack.
       and not (lp.push_count_date = current_date and lp.push_count >= 5)
       -- Refuse to act on data we do not trust. Spec section 8. Today this
       -- excludes IH-PR1, IH-STD2 and TG-PR3.
       and r.next_available is not distinct from public.fn_room_next_available(r.id)
       -- Only actual drift is work.
       and (
             coalesce((lp.desired_state->>'on')::boolean, false)
               is distinct from coalesce((lp.observed_state->>'on')::boolean, false)
          or coalesce(lp.desired_state->>'headline', '')
               is distinct from coalesce(lp.observed_state->>'headline', '')
           )
       -- Turning a listing OFF needs a human yes. On, and headline edits, do
       -- not. Spec section 6.
       and (
             coalesce((lp.desired_state->>'on')::boolean, false) = true
          or coalesce((lp.observed_state->>'on')::boolean, false) = false
          or lp.approved_at is not null
           )
     order by lp.observed_at nulls first, lp.id
     limit p_limit
     for update of lp skip locked
  ),
  claimed as (
    update public.listing_placements lp
       set claimed_by       = p_worker_id,
           claim_token      = gen_random_uuid(),
           claim_expires_at = now() + v_ttl,
           updated_at       = now()
      from candidate c
     where lp.id = c.id
     returning lp.*
  )
  select jsonb_build_object(
           'placement_id',     cl.id,
           'lazybee_ref',      r.lazybee_ref,
           'unit_code',        r.unit_code,
           'external_id',      cl.external_id,
           'url',              cl.url,
           'desired',          cl.desired_state,
           'observed',         cl.observed_state,
           'claim_token',      cl.claim_token,
           'claim_expires_at', cl.claim_expires_at)
    from claimed cl
    join public.rooms r on r.id = cl.room_id;
end;
$$;

comment on function public.fn_claim_listing_work is
  'Claims drifting placements a worker is cleared to act on. An empty result '
  'always means "nothing to do", never "something went wrong". Every refusal '
  'reason is in spec section 4.1.';

commit;
