CREATE OR REPLACE FUNCTION public.find_user_for_password_reset(p_email text)
RETURNS TABLE(user_id uuid, tenant_profile_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $func$
  SELECT u.id, tp.id
  FROM auth.users u
  JOIN public.tenant_profiles tp ON tp.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
    AND tp.is_active = true
  LIMIT 1;
$func$;

REVOKE ALL ON FUNCTION public.find_user_for_password_reset(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_user_for_password_reset(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_for_password_reset(text) TO service_role;
