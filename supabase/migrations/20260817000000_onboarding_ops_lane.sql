-- 20260817000000_onboarding_ops_lane.sql
--
-- The onboarding table has been complete and unwatched. Every step carries
-- a timestamp, the portal fills them in honestly, and nothing anywhere asks
-- the one question that matters: who stopped, and how long ago.
--
-- Asking it for the first time found two tenants who moved in on 15 June
-- and never finished, one of them still without a signed tenancy agreement,
-- and two tenancies that started on 1 August with the deposit unpaid. None
-- of that was hidden. It was simply never read.
--
-- Additive and idempotent: one view, no schema changes, no data touched.

create or replace view public.v_onboardings_stuck as
  select
    o.id,
    o.status,
    o.current_step,
    r.unit_code                                as listing_code,
    coalesce(td.full_name, tp.username)        as tenant_name,
    o.tenancy_start_date,
    o.deposit_amount,
    o.deposit_verified,
    o.updated_at,
    (current_date - o.updated_at::date)        as days_since_moved,
    -- Has the tenancy already begun while the paperwork has not finished?
    -- This is the column that turns a tidy-up list into a priority list:
    -- somebody living in a room without a signed agreement is a different
    -- kind of problem from somebody slow to sign for a November move-in.
    (o.tenancy_start_date is not null
       and o.tenancy_start_date <= current_date)  as tenancy_already_started,
    case
      when o.current_step = 'SIGN_TA'
       and o.tenancy_start_date <= current_date          then 'CRITICAL'
      when o.current_step = 'DEPOSIT'
       and o.tenancy_start_date <= current_date          then 'CRITICAL'
      when o.current_step = 'ID_VERIFICATION'
       and o.tenancy_start_date <= current_date          then 'HIGH'
      when (current_date - o.updated_at::date) >= 14     then 'HIGH'
      when (current_date - o.updated_at::date) >= 5      then 'NORMAL'
      else 'FRESH'
    end                                        as urgency
  from public.onboarding_progress o
  left join public.rooms r            on r.id = o.room_id
  left join public.tenant_profiles tp on tp.id = o.tenant_profile_id
  left join public.tenant_details td  on td.tenant_profile_id = o.tenant_profile_id
  -- ARCHIVED is finished business; ACTIVE at step ACTIVE is a tenant living
  -- their life. Everything else is a half-finished move-in.
  where o.status <> 'ARCHIVED'
    and not (o.status = 'ACTIVE' and o.current_step = 'ACTIVE');

comment on view public.v_onboardings_stuck is
  'Half-finished move-ins, most urgent first. CRITICAL means the tenancy has already started while the agreement is unsigned or the deposit unpaid.';
