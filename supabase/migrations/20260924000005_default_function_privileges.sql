-- Applied to hyve-iot on 23 Sep 2026 via the Management API.
-- Supabase's default privileges gave EXECUTE on every new function in public to
-- PUBLIC and anon, so each new SECURITY DEFINER function was callable with the
-- anon key until someone revoked it by hand (see PRs #139 and #140).
-- New functions created by postgres now get EXECUTE for postgres, authenticated
-- and service_role only. Grant anon explicitly when a public page needs a function.
--
-- Rollback:
--   alter default privileges for role postgres in schema public grant execute on functions to anon;
--   alter default privileges for role postgres grant execute on functions to public;

alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres revoke execute on functions from public;
