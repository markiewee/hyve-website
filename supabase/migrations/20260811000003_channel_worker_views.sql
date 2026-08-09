-- Channel worker contract v1, part 3: what humans read.
begin;

-- Extend the Roomies view with observed state so the tab can show desired,
-- observed and the gap between them rather than desired alone.
--
-- Dropped and recreated rather than replaced: "create or replace view" can only
-- append columns at the end, and these belong next to the state they describe.
-- Inside this transaction, so no reader ever sees the view missing.
drop view if exists public.v_roomies_listing_state;
create view public.v_roomies_listing_state as
select r.id                as room_id,
       r.lazybee_ref,
       r.unit_code,
       r.price_monthly,
       r.min_stay_months,
       lp.id               as placement_id,
       lp.external_id      as roomies_listing_id,
       lp.url              as roomies_url,
       coalesce(lp.status = 'LIVE', false) as is_live,
       lp.observed_state,
       lp.observed_at,
       lp.last_error,
       lp.consecutive_failures,
       lp.frozen_reason,
       lp.approved_at,
       -- Data we refuse to act on. Spec section 8.
       (r.next_available is distinct from public.fn_room_next_available(r.id))
                           as availability_disputed,
       s.desired
  from public.rooms r
  left join public.listing_channels c   on c.slug = 'roomies'
  left join public.listing_placements lp
         on lp.room_id = r.id and lp.channel_id = c.id
  cross join lateral (
       select public.fn_listing_desired_state(
                r.id, coalesce(lp.status = 'LIVE', false)) as desired
  ) s
 where r.room_type is not null;

comment on view public.v_roomies_listing_state is
  'What each Roomies listing should say, what a worker last saw it say, and '
  'whether we trust the underlying availability enough to act.';

-- A view runs with its owner's rights by default, which would hand anon
-- everything in listing_placements through the join.
alter view public.v_roomies_listing_state set (security_invoker = on);
revoke all on public.v_roomies_listing_state from anon;
grant select on public.v_roomies_listing_state to authenticated;

-- Worker liveness, for the health strip on the tab.
create or replace view public.v_channel_worker_health as
select w.worker_id,
       w.channel_slug,
       w.last_seen_at,
       (now() - w.last_seen_at)                        as age,
       (now() - w.last_seen_at) > interval '1 hour'    as is_stale,
       c.enabled                                       as channel_enabled
  from public.channel_workers w
  join public.listing_channels c on c.slug = w.channel_slug;

comment on view public.v_channel_worker_health is
  'Liveness. An empty result means no worker has ever checked in, which is not '
  'the same as everything being fine.';

alter view public.v_channel_worker_health set (security_invoker = on);
revoke all on public.v_channel_worker_health from anon;
grant select on public.v_channel_worker_health to authenticated;

commit;
