-- Migration: handle_new_user now reads role from app_metadata so admin-created
-- accounts (e.g. CI) are inserted with the correct role and is_verified immediately,
-- preventing them from appearing as pending students in the roster.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _roster_id  uuid;
  _full_name  text;
  _email      text;
  _role       text;
  _is_verified boolean;
BEGIN
  _email       := coalesce(new.email, '');
  _full_name   := coalesce(new.raw_user_meta_data->>'full_name', '');
  _roster_id   := NULLIF(new.raw_user_meta_data->>'roster_id', '')::uuid;
  -- Honour role from app_metadata (set by admin-created accounts like CI)
  _role        := coalesce(new.raw_app_meta_data->>'role', 'student');
  -- CI and other admin-created accounts come in pre-verified
  _is_verified := (_role <> 'student');

  -- Remove any orphaned profile row with the same email but a different id.
  DELETE FROM public.profiles WHERE email = _email AND id <> new.id;

  INSERT INTO public.profiles (id, full_name, email, roster_id, role, is_verified, is_active)
  VALUES (new.id, _full_name, _email, _roster_id, _role, _is_verified, true)
  ON CONFLICT (id) DO UPDATE
    SET full_name   = excluded.full_name,
        email       = excluded.email,
        roster_id   = excluded.roster_id,
        role        = excluded.role,
        is_verified = excluded.is_verified;

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'handle_new_user failed for % (%): %', new.id, new.email, sqlerrm;
    RETURN new;
END;
$$;
