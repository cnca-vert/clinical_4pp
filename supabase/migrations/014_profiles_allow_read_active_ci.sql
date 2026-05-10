CREATE POLICY "profiles: read active ci"
  ON public.profiles
  FOR SELECT
  USING (role = 'ci' AND is_active = true);
