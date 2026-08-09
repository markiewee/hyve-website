CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id uuid REFERENCES public.tenant_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  requested_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires_at ON public.password_reset_tokens(expires_at);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (Vercel API) touches this table.
