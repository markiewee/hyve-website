-- Desk bookings: a room desk PIN holder books a room and gets an onboarding
-- link on the spot. Recorded in booking_requests next to Partner API requests
-- so Mark reads one list. Spec: 2026-09-25-staff-desk-booking-link-design.md

alter table public.booking_requests
  add column if not exists source text not null default 'api',
  add column if not exists staff_pin text references public.staff_pins(pin) on delete set null,
  add column if not exists tenant_profile_id uuid references public.tenant_profiles(id) on delete set null,
  add column if not exists quoted_monthly numeric,
  add column if not exists quoted_deposit numeric;

alter table public.booking_requests
  drop constraint if exists booking_requests_source_check;
alter table public.booking_requests
  add constraint booking_requests_source_check check (source in ('api', 'desk'));

create index if not exists booking_requests_staff_pin_idx
  on public.booking_requests (staff_pin, created_at desc);

-- My bookings. Only rows made with this PIN. The student's name is returned
-- because the consultant typed it in. The invite URL is returned only while the
-- link can still be used, so an old list is not a pile of live credentials.
create or replace function public.desk_bookings_for_pin(p_pin text)
returns table (
  id                  uuid,
  created_at          timestamptz,
  unit_code           text,
  move_in             date,
  duration_months     numeric,
  applicant_name      text,
  applicant_email     text,
  quoted_monthly      numeric,
  invite_url          text,
  invite_expires_at   timestamptz,
  signed_up           boolean,
  details_at          timestamptz,
  id_at               timestamptz,
  ta_signed_at        timestamptz,
  deposit_at          timestamptz,
  cancelled           boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select br.id, br.created_at, r.unit_code, br.move_in, br.duration_months,
         br.applicant_name, br.applicant_email, br.quoted_monthly,
         case when tp.user_id is null and tp.invite_token is not null
                   and tp.invite_expires_at > now()
              then 'https://lazybee.sg/portal/signup?token=' || tp.invite_token end,
         tp.invite_expires_at,
         tp.user_id is not null,
         op.personal_details_completed_at, op.id_verification_completed_at,
         op.ta_signed_at, op.deposit_completed_at,
         (tp.id is null or tp.is_active = false)
    from public.booking_requests br
    join public.staff_pins sp on sp.pin = br.staff_pin and sp.enabled = true
    join public.rooms r on r.id = br.room_id
    left join public.tenant_profiles tp on tp.id = br.tenant_profile_id
    left join public.onboarding_progress op on op.tenant_profile_id = tp.id
   where br.staff_pin = p_pin
     and br.source = 'desk'
   order by br.created_at desc
   limit 200;
$$;

revoke all on function public.desk_bookings_for_pin(text) from public;
grant execute on function public.desk_bookings_for_pin(text) to anon, authenticated;
