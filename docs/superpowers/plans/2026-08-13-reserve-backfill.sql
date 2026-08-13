-- Every profile the reserve flow seeded where the recorded move-in disagrees
-- with what the prospect actually asked for. Read-only: produces the worklist.
select
  tp.id              as tenant_profile_id,
  r.unit_code,
  sr.prospect_name,
  sr.prospect_email,
  tp.moved_in_at::date  as recorded_move_in,
  sr.preferred_move_in  as requested_move_in,
  sr.duration_months,
  tp.lease_end,
  o.current_step,
  o.personal_details_completed_at is not null as did_details,
  o.id_verification_completed_at  is not null as did_id,
  o.ta_signed_at                  is not null as signed_ta,
  tp.is_active,
  tp.created_at
from soft_reserves sr
join tenant_profiles tp on tp.id = sr.tenant_profile_id
left join rooms r on r.id = tp.room_id
left join onboarding_progress o on o.tenant_profile_id = tp.id
where sr.preferred_move_in is not null
  and tp.moved_in_at::date <> sr.preferred_move_in
order by tp.created_at desc;

-- Duplicate profiles: one person, one room, more than one live profile.
select
  sr.prospect_email,
  tp.room_id,
  count(*)                        as live_profiles,
  array_agg(tp.id order by tp.created_at) as profile_ids
from soft_reserves sr
join tenant_profiles tp on tp.id = sr.tenant_profile_id
where tp.is_active
  and sr.prospect_email is not null
group by sr.prospect_email, tp.room_id
having count(*) > 1;
