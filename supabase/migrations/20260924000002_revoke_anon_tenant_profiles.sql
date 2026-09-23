-- Close the last anon read on tenant_profiles.
--
-- The policy "Anon read profiles for viewing assignment" let the public anon
-- key (it ships in the lazybee.sg bundle) select every active tenant_profiles
-- row. The 4 Aug RLS pass already cut the anon column grant down to
-- id, is_active, property_id, role and room_id, so no name, phone, email, ID
-- or rent was readable. What was still readable: 32 active rows mapping each
-- profile id to its room, property and role, which is who lives where and
-- which rooms are occupied.
--
-- Nothing depends on it any more. book.lazybee.sg self-scheduling, which the
-- policy was written for, now runs server side with the service role, and
-- every api/ route and edge function that touches tenant_profiles uses the
-- service role too. pg_stat_statements shows no anon reads of the table other
-- than audit probes. The invoker functions that read tenant_profiles
-- (fn_room_next_available, rooms_with_availability, recompute_room_na) already
-- fail for anon because the column grant does not cover lease_end or
-- moved_in_at, so revoking changes nothing for them. lazybee.sg reads room
-- dates through get_room_availability(), which is security definer and keeps
-- working.
--
-- No replacement RPC is added: no anon caller needs any tenant_profiles field.
--
-- Rollback (restores the exact previous state):
--   grant select (id, is_active, property_id, role, room_id)
--     on public.tenant_profiles to anon;
--   grant insert, update, delete, truncate, references, trigger
--     on public.tenant_profiles to anon;
--   create policy "Anon read profiles for viewing assignment"
--     on public.tenant_profiles for select to anon using (is_active = true);

drop policy if exists "Anon read profiles for viewing assignment"
  on public.tenant_profiles;

-- Column-level select first, then everything table-level. anon has no
-- insert/update/delete policy so RLS already refused those, but TRUNCATE is not
-- subject to RLS, so the grant goes too.
revoke select (id, is_active, property_id, role, room_id)
  on public.tenant_profiles from anon;
revoke all on public.tenant_profiles from anon;
