-- Expand rooms_with_availability() to return the full room product card.
-- Adds: name, size_sqm, floor, has_private_bathroom, has_aircon,
-- furnishing_level, deposit_months, min_stay_months, max_occupancy,
-- bed_size, amenities, facilities, description, photos, next_available_hint,
-- upcoming_bookings.
--
-- available_from logic unchanged from 20260513000001 — overrides the
-- rooms.next_available hint with the day after the last active tenant's
-- lease_end if later.

drop function if exists public.rooms_with_availability();

create or replace function public.rooms_with_availability()
returns table (
  room_code             text,
  property_code         text,
  room_name             text,
  monthly_rent          numeric,
  room_type             text,
  bed_size              text,
  size_sqm              numeric,
  floor                 integer,
  has_private_bathroom  boolean,
  has_aircon            boolean,
  furnishing_level      text,
  deposit_months        integer,
  min_stay_months       integer,
  max_occupancy         integer,
  amenities             jsonb,
  facilities            jsonb,
  description           text,
  photos                jsonb,
  upcoming_bookings     jsonb,
  available_from        date
) language sql stable as $$
  select
    r.unit_code                              as room_code,
    p.code                                   as property_code,
    r.name                                   as room_name,
    r.price_monthly                          as monthly_rent,
    r.room_type                              as room_type,
    r.bed_size                               as bed_size,
    r.size_sqm                               as size_sqm,
    r.floor                                  as floor,
    r.has_private_bathroom                   as has_private_bathroom,
    r.has_aircon                             as has_aircon,
    r.furnishing_level                       as furnishing_level,
    r.deposit_months                         as deposit_months,
    r.min_stay_months                        as min_stay_months,
    r.max_occupancy                          as max_occupancy,
    coalesce(r.amenities,  '[]'::jsonb)      as amenities,
    coalesce(r.facilities, '[]'::jsonb)      as facilities,
    r.description                            as description,
    coalesce(r.photos,     '[]'::jsonb)      as photos,
    coalesce(r.upcoming_bookings, '[]'::jsonb) as upcoming_bookings,
    coalesce(
      (
        select (max(tp.lease_end) + interval '1 day')::date
        from public.tenant_profiles tp
        where tp.room_id = r.id
          and tp.is_active = true
          and tp.lease_end is not null
          and tp.lease_end >= current_date
      ),
      case
        when r.next_available is not null and r.next_available >= current_date
          then r.next_available
        else current_date
      end
    )                                         as available_from
  from public.rooms r
  join public.properties p on p.id = r.property_id;
$$;

grant execute on function public.rooms_with_availability() to anon, authenticated, service_role;
