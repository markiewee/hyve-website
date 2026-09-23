-- Take EXECUTE away from anon (and PUBLIC) on security definer functions that
-- no signed-out caller uses.
--
-- A security definer function runs as its owner (postgres), so RLS does not
-- apply inside it. Supabase's default privileges grant EXECUTE on every new
-- public function to PUBLIC, anon and authenticated, and the anon key ships in
-- the lazybee.sg bundle. On 23 Sep 40 security definer functions in public were
-- callable by anyone holding that key through /rest/v1/rpc/<name>. The worst:
-- add_roommate, which inserts a tenant_profiles row plus a tenant_details row
-- (name, ID number, phone) against any active tenancy, with no check on the
-- caller and no pinned search_path. Next worst: the cron jobs
-- (fn_auto_archive_tenants, fn_activate_started_tenants, the chase jobs,
-- sweep_stale_room_holds) and the channel worker RPCs, all of which write.
--
-- Callers were found by grepping hyve-website origin/master (src, api,
-- supabase/functions), the hyve-booking clone on main, every other local
-- worktree, ~/.claude/skills, cron.job, pg_policies, view and function bodies,
-- pg_stat_statements since 22 Sep and the last 24h of API edge logs. The only
-- anon RPC traffic is the staff desk PIN functions and get_room_availability.
--
-- Kept as they are (anon has a real caller):
--   get_room_availability            lazybee.sg room pages, signed out
--   redeem_staff_pin, housemates_for_staff_pin, channel_for_staff_pin,
--   staff_pin_display_name           /staff desk, signed out behind a PIN
--   get_user_role, get_user_property_id
--                                    referenced by RLS policies granted TO
--                                    public, so anon evaluates them on every
--                                    read of those tables; revoking would turn
--                                    an empty result into a permission error
--
-- anon and PUBLIC revoked, authenticated kept (signed-in callers only):
--   get_landlord_roster, get_landlord_documents   LandlordPage.jsx
--   current_landlord_property, is_portal_admin    policies TO authenticated
--
-- anon, PUBLIC and authenticated revoked (service_role and postgres keep it):
--   cron jobs, all owned by postgres:
--     fn_auto_archive_tenants, fn_activate_started_tenants,
--     fn_recompute_all_room_availability, sweep_stale_room_holds,
--     fn_heartbeat_check, fn_viewing_reminder_sweep, fn_chase_expired_passes,
--     fn_chase_unsigned_ta
--   one-off schedulers: fn_schedule_partner_dispatch, fn_schedule_rent_cron
--   availability: fn_recompute_room_availability (called by the triggers)
--   channel worker RPCs: fn_claim_listing_work, fn_report_listing_result,
--     fn_worker_heartbeat, fn_link_placement (workers use the service role
--     key and, since 11 Aug, the Partner API)
--   internal helpers: next_tenancy_ref, rooms_for_pin (only called from other
--     security definer functions, which run as postgres)
--   trigger and event trigger functions: apply_partner_inbound, audit_trigger,
--     enqueue_ticket_to_partner, fn_partner_enqueue_booking_event,
--     fn_partner_enqueue_event, fn_rent_payments_mint_ref, notify_ta_ready,
--     onboarding_progress_fill_contract_fields, trg_op_recompute_availability,
--     trg_tp_recompute_availability, rls_auto_enable. Postgres checks EXECUTE
--     on a trigger function only at CREATE TRIGGER, never when it fires, so
--     the triggers keep running for every role.
--   add_roommate: no live caller. AddRoommateModal.jsx was never mounted and
--     was deleted in #127. The body is also rewritten below: search_path is
--     pinned and a caller who is not the service role must be a portal admin
--     or the user on the primary tenancy.
--
-- Rollback: the exact previous ACL of every function, and the previous
-- add_roommate body, are in
-- claudine/docs/security/rls-backup-2026-09-23-anon-rpcs.json. For each
-- revoked function:
--   grant execute on function public.<sig> to public, anon, authenticated;

-- add_roommate: pin search_path and check the caller.
create or replace function public.add_roommate(
  p_primary_tenant_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_id_type text default 'NRIC',
  p_id_number text default null,
  p_nationality text default null,
  p_moved_in_at date default null
)
returns table(new_tenant_id uuid, status_msg text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_primary record;
  v_new_tenant_id uuid;
begin
  -- Direct SQL (postgres, no JWT) and the service role pass. Anyone else must
  -- be a portal admin or the signed-in user on the primary tenancy.
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    if auth.uid() is null
       or not (
         public.is_portal_admin()
         or exists (
           select 1 from public.tenant_profiles
            where id = p_primary_tenant_id and user_id = auth.uid()
         )
       ) then
      raise exception 'add_roommate: not allowed' using errcode = '42501';
    end if;
  end if;

  select id, room_id, property_id, lease_end, lease_months, is_active, is_primary
    into v_primary
    from public.tenant_profiles
   where id = p_primary_tenant_id;

  if not found then
    return query select null::uuid, 'ERROR: primary tenant not found'::text;
    return;
  end if;
  if not v_primary.is_active then
    return query select null::uuid, 'ERROR: primary tenant is not active'::text;
    return;
  end if;
  if not v_primary.is_primary then
    return query select null::uuid, 'ERROR: target is already a roommate, not a primary tenant'::text;
    return;
  end if;

  insert into public.tenant_profiles (
    room_id, property_id, role, is_active, is_primary,
    moved_in_at, monthly_rent, late_fee_per_day,
    lease_end, lease_months
  ) values (
    v_primary.room_id, v_primary.property_id, 'TENANT', true, false,
    coalesce(p_moved_in_at::timestamptz, now()), 0, 5,
    v_primary.lease_end, v_primary.lease_months
  ) returning id into v_new_tenant_id;

  insert into public.tenant_details (
    tenant_profile_id, full_name, email, phone, id_type, id_number, nationality
  ) values (
    v_new_tenant_id, p_full_name, p_email, p_phone, p_id_type, p_id_number, p_nationality
  );

  return query select v_new_tenant_id, 'OK: roommate added (rent=$0, is_primary=false)'::text;
end;
$function$;

-- Signed-in callers only.
revoke execute on function public.get_landlord_roster() from public, anon;
revoke execute on function public.get_landlord_documents() from public, anon;
revoke execute on function public.current_landlord_property() from public, anon;
revoke execute on function public.is_portal_admin() from public, anon;

-- service_role and postgres only.
do $$
declare
  sig text;
begin
  foreach sig in array array[
    'public.add_roommate(uuid,text,text,text,text,text,text,date)',
    'public.fn_auto_archive_tenants()',
    'public.fn_activate_started_tenants()',
    'public.fn_recompute_all_room_availability()',
    'public.fn_recompute_room_availability(uuid)',
    'public.sweep_stale_room_holds()',
    'public.fn_heartbeat_check()',
    'public.fn_viewing_reminder_sweep()',
    'public.fn_chase_expired_passes()',
    'public.fn_chase_unsigned_ta()',
    'public.fn_schedule_partner_dispatch()',
    'public.fn_schedule_rent_cron(text,text,text)',
    'public.fn_claim_listing_work(text,text,integer)',
    'public.fn_report_listing_result(uuid,uuid,jsonb,text)',
    'public.fn_worker_heartbeat(text,text,jsonb)',
    'public.fn_link_placement(text,text,text,text)',
    'public.next_tenancy_ref(text,integer)',
    'public.rooms_for_pin(text,numeric)',
    'public.apply_partner_inbound()',
    'public.audit_trigger()',
    'public.enqueue_ticket_to_partner()',
    'public.fn_partner_enqueue_booking_event()',
    'public.fn_partner_enqueue_event()',
    'public.fn_rent_payments_mint_ref()',
    'public.notify_ta_ready()',
    'public.onboarding_progress_fill_contract_fields()',
    'public.trg_op_recompute_availability()',
    'public.trg_tp_recompute_availability()',
    'public.rls_auto_enable()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', sig);
    execute format('grant execute on function %s to service_role', sig);
  end loop;
end $$;
