ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ci_login_email text,
  ADD COLUMN IF NOT EXISTS ci_credentials_expire_at timestamptz;
