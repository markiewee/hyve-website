-- Availability means a window someone can actually take, not an empty day.
--
-- The first version of fn_room_next_available returned the first date not
-- covered by a block. Comparing it against the live column immediately showed
-- why that is wrong: IH-STD4 has a tenancy starting 15 Aug and a six-month
-- minimum stay, so the function reported it "available" today on the strength
-- of a six-day gap. TG-MR had the same shape.
--
-- A gap shorter than the minimum stay is not availability, it is a gap. This
-- version skips them.

begin;

-- The new signature takes an extra defaulted argument, so `create or replace`
-- would ADD an overload rather than replace, and every existing single-argument
-- call would become ambiguous. Drop the old one first. The view depends on it,
-- so it goes and comes back.
drop view if exists public.v_room_availability_drift;
drop function if exists public.fn_room_next_available(uuid, date);

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

    select max(coalesce(c.ends_on, 'infinity'::date))
      into blocked_to
      from public.room_calendar c
     where c.room_id = p_room_id
       and c.status = 'ACTIVE'
       and c.blocks
       and c.starts_on <= cursor_date
       and (c.ends_on is null or c.ends_on >= cursor_date);

    if blocked_to = 'infinity'::date then
      return null;                      -- occupied with no agreed end date
    end if;

    if blocked_to is not null then
      cursor_date := blocked_to + 1;    -- chain straight into the next test
      continue;
    end if;

    -- cursor_date is free. How long does that last?
    select min(c.starts_on) into next_start
      from public.room_calendar c
     where c.room_id = p_room_id
       and c.status = 'ACTIVE'
       and c.blocks
       and c.starts_on > cursor_date;

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

comment on function public.fn_room_next_available is
  'First date a room is free for at least its minimum stay. Skips gaps too '
  'short to let and chains back-to-back blocks. A six-day gap before a nine-'
  'month tenancy is not availability.';

create or replace view public.v_room_availability_drift as
select r.id as room_id,
       r.unit_code,
       r.next_available            as stored_next_available,
       public.fn_room_next_available(r.id) as derived_next_available
  from public.rooms r
 where r.room_type is not null
   and r.next_available is distinct from public.fn_room_next_available(r.id);

comment on view public.v_room_availability_drift is
  'Rooms where the hand-maintained next_available disagrees with the calendar. '
  'Must be empty or fully explained before anything is switched to derived.';

commit;
