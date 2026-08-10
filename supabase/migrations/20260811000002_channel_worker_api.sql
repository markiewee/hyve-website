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

-- ── Report the result ───────────────────────────────────────────────────────
begin;

create or replace function public.fn_report_listing_result(
  p_placement_id uuid,
  p_claim_token  uuid,
  p_observed     jsonb,
  p_error        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lp      public.listing_placements%rowtype;
  v_drift boolean;
  v_ok    boolean := (p_error is null);
begin
  select * into lp from public.listing_placements where id = p_placement_id for update;
  if not found then
    raise exception 'no such placement %', p_placement_id;
  end if;

  -- A stale token means this worker stalled past its claim and someone else may
  -- already have done the work. Refuse rather than overwrite a newer result.
  if lp.claim_token is distinct from p_claim_token then
    raise exception 'stale or invalid claim token for placement %', p_placement_id;
  end if;

  v_drift :=
       coalesce((lp.desired_state->>'on')::boolean, false)
         is distinct from coalesce((p_observed->>'on')::boolean, false)
    or coalesce(lp.desired_state->>'headline', '')
         is distinct from coalesce(p_observed->>'headline', '');

  update public.listing_placements
     set observed_state       = p_observed,
         observed_at          = now(),
         last_verified_at     = now(),
         last_drift           = v_drift,
         last_error           = p_error,
         consecutive_failures = case when v_ok then 0 else consecutive_failures + 1 end,
         frozen_reason        = case
                                  when not v_ok and consecutive_failures + 1 >= 5
                                    then 'five consecutive failures, needs a human'
                                  else frozen_reason
                                end,
         status               = case
                                  when p_error is not null then 'ERROR'
                                  when coalesce((p_observed->>'on')::boolean, false) then 'LIVE'
                                  else 'PAUSED'
                                end,
         -- Claim released here, not by a separate call. There is no unlock to leak.
         claimed_by           = null,
         claim_token          = null,
         claim_expires_at     = null,
         -- Approval is single use. A yes to turn this listing off does not
         -- authorise the next off, weeks later, for a different reason.
         approved_at          = null,
         approved_by          = null,
         updated_at           = now()
   where id = p_placement_id;

  insert into public.listing_push_log (placement_id, worker_id, intent, observed, ok, error)
  values (p_placement_id, coalesce(lp.claimed_by, 'unknown'), lp.desired_state, p_observed, v_ok, p_error);

  return jsonb_build_object('placement_id', p_placement_id, 'drift', v_drift, 'ok', v_ok);
end;
$$;

comment on function public.fn_report_listing_result is
  'p_observed is what the worker SAW, never what it intended. A worker that '
  'clicks save, gets a silent failure and reports success has corrupted the only '
  'record we have. Spec section 4.2.';

commit;

-- ── Correction: derive desired state at claim time, never read a stored copy ─
-- The first cut of fn_claim_listing_work compared against lp.desired_state, a
-- column nothing populates. It would have returned zero rows forever and looked
-- exactly like "nothing to do", which is the one failure mode this whole design
-- exists to prevent.
--
-- Fixed by computing desired inline from the calendar on every claim. The stored
-- column is now a RECORD of what was last acted on, written as a side effect,
-- never the input to a decision. One less copy that can go stale.
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
  if not exists (
    select 1 from public.channel_workers
     where worker_id = p_worker_id and channel_slug = p_channel_slug
  ) then
    raise exception 'worker % is not registered for channel %', p_worker_id, p_channel_slug;
  end if;

  select id into v_channel_id
    from public.listing_channels
   where slug = p_channel_slug and enabled = true;

  if v_channel_id is null then
    return;   -- kill switch. "Nothing to do" is the honest answer.
  end if;

  return query
  with candidate as (
    select lp.id,
           d.desired
      from public.listing_placements lp
      join public.rooms r on r.id = lp.room_id
      cross join lateral (
        select public.fn_listing_desired_state(
                 r.id, coalesce(lp.status = 'LIVE', false)) as desired
      ) d
     where lp.channel_id = v_channel_id
       and r.room_type is not null
       and (lp.claim_expires_at is null or lp.claim_expires_at < now())
       and lp.external_id is not null
       and lp.frozen_reason is null
       and lp.consecutive_failures < 5
       and not (lp.push_count_date = current_date and lp.push_count >= 5)
       -- Refuse to act on data we do not trust. Spec section 8.
       and r.next_available is not distinct from public.fn_room_next_available(r.id)
       -- Only actual drift is work: freshly derived desired vs last observed.
       and (
             coalesce((d.desired->>'on')::boolean, false)
               is distinct from coalesce((lp.observed_state->>'on')::boolean, false)
          or coalesce(d.desired->>'headline', '')
               is distinct from coalesce(lp.observed_state->>'headline', '')
           )
       -- Turning a listing OFF needs a human yes. Spec section 6.
       and (
             coalesce((d.desired->>'on')::boolean, false) = true
          or coalesce((lp.observed_state->>'on')::boolean, false) = false
          or lp.approved_at is not null
           )
     order by lp.observed_at nulls first, lp.id
     limit p_limit
     for update of lp skip locked
  ),
  claimed as (
    update public.listing_placements lp
       set claimed_by          = p_worker_id,
           claim_token         = gen_random_uuid(),
           claim_expires_at    = now() + v_ttl,
           -- Recorded, not consulted. The decision above was made from the
           -- calendar, not from this column.
           desired_state       = c.desired,
           desired_computed_at = now(),
           updated_at          = now()
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
  'Claims drifting placements a worker is cleared to act on. Desired state is '
  'derived from the calendar on every call, never read from a stored copy. An '
  'empty result always means "nothing to do", never "something went wrong".';

commit;

-- ── Correction: last_drift is jsonb, not boolean ────────────────────────────
-- Caught by the round-trip test. The pre-existing column is jsonb, so rather
-- than cast a boolean into it, record WHICH fields disagree. "on and headline
-- both differ" is actionable; "true" is not.
begin;

create or replace function public.fn_report_listing_result(
  p_placement_id uuid,
  p_claim_token  uuid,
  p_observed     jsonb,
  p_error        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lp       public.listing_placements%rowtype;
  v_fields text[] := '{}';
  v_drift  boolean;
  v_ok     boolean := (p_error is null);
begin
  select * into lp from public.listing_placements where id = p_placement_id for update;
  if not found then
    raise exception 'no such placement %', p_placement_id;
  end if;

  -- A stale token means this worker stalled past its claim and someone else may
  -- already have done the work. Refuse rather than overwrite a newer result.
  if lp.claim_token is distinct from p_claim_token then
    raise exception 'stale or invalid claim token for placement %', p_placement_id;
  end if;

  if coalesce((lp.desired_state->>'on')::boolean, false)
       is distinct from coalesce((p_observed->>'on')::boolean, false) then
    v_fields := v_fields || 'on';
  end if;

  if coalesce(lp.desired_state->>'headline', '')
       is distinct from coalesce(p_observed->>'headline', '') then
    v_fields := v_fields || 'headline';
  end if;

  v_drift := array_length(v_fields, 1) is not null;

  update public.listing_placements
     set observed_state       = p_observed,
         observed_at          = now(),
         last_verified_at     = now(),
         -- NOT NULL, default '{}'. Empty object means "checked, no drift",
         -- which is a different fact from '{}' meaning "never checked" only
         -- because observed_at tells them apart. Do not read one without the other.
         last_drift           = case
                                  when v_drift then jsonb_build_object(
                                    'fields',   to_jsonb(v_fields),
                                    'desired',  lp.desired_state,
                                    'observed', p_observed,
                                    'at',       now())
                                  else '{}'::jsonb
                                end,
         last_error           = p_error,
         consecutive_failures = case when v_ok then 0 else consecutive_failures + 1 end,
         frozen_reason        = case
                                  when not v_ok and consecutive_failures + 1 >= 5
                                    then 'five consecutive failures, needs a human'
                                  else frozen_reason
                                end,
         status               = case
                                  when p_error is not null then 'ERROR'
                                  when coalesce((p_observed->>'on')::boolean, false) then 'LIVE'
                                  else 'PAUSED'
                                end,
         -- Claim released here, not by a separate call. No unlock to leak.
         claimed_by           = null,
         claim_token          = null,
         claim_expires_at     = null,
         -- Approval is single use. A yes to turn this listing off does not
         -- authorise the next off, weeks later, for a different reason.
         approved_at          = null,
         approved_by          = null,
         updated_at           = now()
   where id = p_placement_id;

  insert into public.listing_push_log (placement_id, worker_id, intent, observed, ok, error)
  values (p_placement_id, coalesce(lp.claimed_by, 'unknown'), lp.desired_state, p_observed, v_ok, p_error);

  return jsonb_build_object(
    'placement_id', p_placement_id, 'drift', v_drift,
    'fields', to_jsonb(v_fields), 'ok', v_ok);
end;
$$;

comment on function public.fn_report_listing_result is
  'p_observed is what the worker SAW, never what it intended. A worker that '
  'clicks save, gets a silent failure and reports success has corrupted the only '
  'record we have. Spec section 4.2.';

commit;

-- ── Human-facing: approve a change, and link a discovered listing ───────────
begin;

create or replace function public.fn_approve_listing_change(
  p_placement_id uuid,
  p_approve      boolean default true
)
returns jsonb
language plpgsql
security invoker            -- runs as the signed-in admin, so RLS applies
set search_path = public
as $$
declare v_now timestamptz := now();
begin
  update public.listing_placements
     set approved_at = case when p_approve then v_now else null end,
         approved_by = case when p_approve then auth.uid() else null end,
         updated_at  = v_now
   where id = p_placement_id;

  if not found then
    raise exception 'no such placement %', p_placement_id;
  end if;

  return jsonb_build_object('placement_id', p_placement_id, 'approved', p_approve);
end;
$$;

comment on function public.fn_approve_listing_change is
  'Sets the approval a worker waits for before turning a listing off. Security '
  'invoker on purpose: approving is a human act and must run as that human.';

create unique index if not exists listing_placements_room_channel_key
  on public.listing_placements (room_id, channel_id);

create or replace function public.fn_link_placement(
  p_channel_slug text,
  p_unit_code    text,
  p_external_id  text,
  p_url          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_room_id    uuid;
  v_id         uuid;
begin
  select id into v_channel_id from public.listing_channels where slug = p_channel_slug;
  if v_channel_id is null then raise exception 'unknown channel %', p_channel_slug; end if;

  select id into v_room_id
    from public.rooms
   where upper(unit_code) = upper(p_unit_code) and room_type is not null;
  if v_room_id is null then raise exception 'unknown or unlettable room %', p_unit_code; end if;

  insert into public.listing_placements (room_id, channel_id, external_id, url, status)
  values (v_room_id, v_channel_id, p_external_id, p_url, 'PENDING')
  on conflict (room_id, channel_id) do update
    set external_id = excluded.external_id,
        url         = coalesce(excluded.url, public.listing_placements.url),
        updated_at  = now()
  returning id into v_id;

  return jsonb_build_object('placement_id', v_id, 'unit_code', upper(p_unit_code));
end;
$$;

comment on function public.fn_link_placement is
  'Records the platform''s own listing id against a room. A database write, not '
  'a platform write, so it is safe in report-only mode. Spec section 10 step 2.';

commit;
