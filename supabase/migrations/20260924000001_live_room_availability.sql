-- lazybee.sg reads each room's next free date live instead of from a static file.
--
-- 1. fn_room_next_available: count live tenancies, not only room_calendar.
--
-- The function only looked at room_calendar. That table was seeded from
-- onboarding_progress in August and is not written when a tenancy is added
-- later, so a new booking can exist in tenant_profiles and be missing from the
-- calendar. On 23 Sep IH-PR1 showed the edge case: the previous tenancy ended
-- 18 Sep and Lee moves in 26 Sep, but Lee's tenancy had no calendar row. The
-- function saw a free day today, found nothing after it, and reported the room
-- free now. Had it seen Lee, the 3-day leading gap would have been skipped as
-- too short to sell and the answer would have been 26 Sep 2027.
--
-- Active TENANT and HOUSE_CAPTAIN rows in tenant_profiles now block the room
-- from moved_in_at to lease_end, alongside the calendar's blocking rows. This
-- is the same chain the lazybee-rooms-state report uses. A tenancy with no
-- lease_end blocks with no end date, the same as a calendar row with no ends_on.
-- Signature is unchanged, so create or replace swaps the body in place and the
-- Partner API, fn_listing_desired_state and v_room_availability_drift keep
-- working against the same function.
--
-- 2. get_room_availability(): the one read the public site makes.
--
-- Returns unit_code and next_available for every lettable room and nothing
-- else: no tenant names, no tenancy dates, no ids. It is security definer
-- because anon cannot read tenant_profiles or room_calendar under RLS, which
-- is why the output is limited to those two columns. Called once per page
-- load from the browser. No cron, no polling.
--
-- Rollback: re-apply fn_room_next_available from
-- 20260810000004_next_available_min_window.sql and
-- drop function public.get_room_availability();

create or replace function public.fn_room_next_available(
  p_room_id uuid,
  p_from    date default current_date,
  p_min_days integer default null
)
returns date
language plpgsql
stable
as $$
declare
  cursor_date date := p_from;
  blocked_to  date;
  next_start  date;
  min_days    integer;
  guard       integer := 0;
begin
  -- Default the usable window to the room's own minimum stay. Falling back to
  -- 90 days matches the 3-month floor Lazybee quotes when nothing is set.
  if p_min_days is not null then
    min_days := p_min_days;
  else
    select coalesce(min_stay_months, 3) * 30 into min_days
      from public.rooms where id = p_room_id;
    min_days := coalesce(min_days, 90);
  end if;

  loop
    guard := guard + 1;
    if guard > 200 then
      return null;  -- pathological calendar; refuse rather than spin
    end if;

    select max(coalesce(b.ends_on, 'infinity'::date))
      into blocked_to
      from (
        select c.starts_on, c.ends_on
          from public.room_calendar c
         where c.room_id = p_room_id
           and c.status = 'ACTIVE'
           and c.blocks
        union all
        select tp.moved_in_at::date, tp.lease_end
          from public.tenant_profiles tp
         where tp.room_id = p_room_id
           and tp.is_active
           and tp.archived_at is null
           and tp.role in ('TENANT', 'HOUSE_CAPTAIN')
           and tp.moved_in_at is not null
      ) b
     where b.starts_on <= cursor_date
       and (b.ends_on is null or b.ends_on >= cursor_date);

    if blocked_to = 'infinity'::date then
      return null;                      -- occupied with no agreed end date
    end if;

    if blocked_to is not null then
      cursor_date := blocked_to + 1;    -- chain straight into the next test
      continue;
    end if;

    -- cursor_date is free. How long does that last?
    select min(b.starts_on) into next_start
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
     where b.starts_on > cursor_date;

    if next_start is null then
      return cursor_date;               -- free from here on
    end if;

    if (next_start - cursor_date) >= min_days then
      return cursor_date;               -- a window someone can actually take
    end if;

    cursor_date := next_start;          -- gap too short to sell; skip it
  end loop;
end;
$$;

create or replace function public.get_room_availability()
returns table (unit_code text, next_available date)
language sql
stable
security definer
set search_path = public
as $$
  select r.unit_code::text, public.fn_room_next_available(r.id)
    from public.rooms r
   where r.room_type is not null
     and r.unit_code is not null
   order by r.unit_code;
$$;

revoke all on function public.get_room_availability() from public;
grant execute on function public.get_room_availability() to anon, authenticated, service_role;
