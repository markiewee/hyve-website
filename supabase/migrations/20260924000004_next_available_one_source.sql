-- rooms.next_available: one rule, and room_calendar edits recompute it.
--
-- Two code paths wrote the same column with different rules.
--   * fn_room_next_available(room_id) is the rule the Partner API,
--     get_room_availability (lazybee.sg) and v_room_availability_drift use. It
--     chains room_calendar blocks and active TENANT / HOUSE_CAPTAIN tenancies,
--     follows back-to-back leases, and skips gaps shorter than the room's
--     minimum stay.
--   * fn_recompute_room_availability(room_id), fired by the tenant_profiles and
--     onboarding_progress triggers and the nightly sync-room-availability cron,
--     had its own older logic: it ignored tenancies with monthly_rent = 0 (the
--     rent-free Airbnb tenancies), looked at only the current or first future
--     lease so a follow-on lease was missed, and never read room_calendar.
-- And room_calendar had no trigger at all, so adding or moving a block left
-- the column stale until someone touched a tenancy in that room.
--
-- Readers of rooms.next_available: book.lazybee.sg room list, room page and
-- reserve form, fn_claim_listing_work, v_roomies_listing_state,
-- rooms_with_availability, the /staff desk.
--
-- Change:
--   1. fn_recompute_room_availability takes next_available from
--      fn_room_next_available(room_id). Rooms with no room_type (common areas,
--      toilets, yards) stay null, as before. available_until keeps its old
--      meaning, "free now but booked from a later date": when the room is free
--      today it is the day before the next block or tenancy starts, else null.
--      search_path is pinned with pg_temp.
--   2. New AFTER INSERT/UPDATE/DELETE row trigger on room_calendar recomputes
--      the old and new room.
--   3. The nightly sync cron moves from 18:45 UTC to 00:05 UTC. The drift view
--      and fn_room_next_available count days by current_date (UTC), so a room
--      that is free now derives a new date at 00:00 UTC; running the sync just
--      after that keeps v_room_availability_drift empty all day.
--
-- Rollback: re-apply the old fn_recompute_room_availability body from
-- claudine/docs/security/rls-backup-2026-09-23-anon-rpcs.json, then
--   drop trigger if exists trg_rc_recompute_availability on public.room_calendar;
--   drop function if exists public.trg_rc_recompute_availability();
--   select cron.alter_job(jobid, schedule := '45 18 * * *')
--     from cron.job where jobname = 'sync-room-availability';

create or replace function public.fn_recompute_room_availability(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_type       text;
  v_next       date := null;
  v_until      date := null;
  v_next_start date;
begin
  if p_room_id is null then return; end if;

  select room_type into v_type from public.rooms where id = p_room_id;
  if not found then return; end if;

  if v_type is not null then
    v_next := public.fn_room_next_available(p_room_id);

    -- Free today: how long for? fn_room_next_available only returns today when
    -- the free window is at least the room's minimum stay, so this bound is
    -- never inside a gap too short to sell.
    if v_next is not null and v_next <= current_date then
      select min(b.starts_on) into v_next_start
        from (
          select c.starts_on
            from public.room_calendar c
           where c.room_id = p_room_id
             and c.status = 'ACTIVE'
             and c.blocks
          union all
          select tp.moved_in_at::date
            from public.tenant_profiles tp
           where tp.room_id = p_room_id
             and tp.is_active
             and tp.archived_at is null
             and tp.role in ('TENANT', 'HOUSE_CAPTAIN')
             and tp.moved_in_at is not null
        ) b
       where b.starts_on > current_date;

      if v_next_start is not null then
        v_until := v_next_start - 1;
      end if;
    end if;
  end if;

  update public.rooms
     set next_available  = v_next,
         available_until = v_until
   where id = p_room_id
     and (next_available is distinct from v_next
          or available_until is distinct from v_until);
end;
$function$;

revoke execute on function public.fn_recompute_room_availability(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_recompute_room_availability(uuid) to service_role;

create or replace function public.trg_rc_recompute_availability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op <> 'INSERT' then
    perform public.fn_recompute_room_availability(old.room_id);
  end if;
  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE' and new.room_id is distinct from old.room_id) then
    perform public.fn_recompute_room_availability(new.room_id);
  end if;
  return null;
end;
$function$;

revoke execute on function public.trg_rc_recompute_availability()
  from public, anon, authenticated;
grant execute on function public.trg_rc_recompute_availability() to service_role;

drop trigger if exists trg_rc_recompute_availability on public.room_calendar;
create trigger trg_rc_recompute_availability
  after insert or update or delete on public.room_calendar
  for each row execute function public.trg_rc_recompute_availability();

select cron.alter_job(jobid, schedule := '5 0 * * *')
  from cron.job
 where jobname = 'sync-room-availability';

-- Bring every room onto the new rule now rather than at the next cron run.
select public.fn_recompute_all_room_availability();
