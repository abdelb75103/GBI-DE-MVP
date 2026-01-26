-- ============================================================================
-- ADD PROFILE: Mujtaba
-- ============================================================================
--
-- Creates auth.users + profiles entry and sets a profile password hash.
-- Run in Supabase Dashboard > SQL Editor.
--
-- NOTE:
-- - The profile password is used by the app's profile sign-in flow.
-- - The auth.users password is only to satisfy the FK constraint.
--
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  mujtaba_id UUID := 'b9afb855-0f85-44f4-af79-afe476d7d1bf'::uuid;
  instance_uuid UUID;
  temp_password TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT u.instance_id FROM auth.users u LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO instance_uuid;

  -- Temp password for auth.users (not used by the app's profile sign-in)
  temp_password := crypt('temp-password-' || mujtaba_id::text, gen_salt('bf'));

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  )
  SELECT
    mujtaba_id,
    instance_uuid,
    'mujtaba@fifa-gbi.local',
    temp_password,
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Mujtaba"}'::jsonb,
    false,
    'authenticated'
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = mujtaba_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    preferred_email,
    password_hash,
    created_at,
    updated_at
  )
  VALUES (
    mujtaba_id,
    'Mujtaba',
    'extractor',
    NULL,
    crypt('G7m#kP2v!H', gen_salt('bf', 10)),
    now(),
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    password_hash = COALESCE(profiles.password_hash, EXCLUDED.password_hash),
    updated_at = now();

  RAISE NOTICE 'Profile ready for Mujtaba (id: %)', mujtaba_id;
END $$;

-- Verify profile entry
SELECT
  id,
  full_name,
  role,
  CASE
    WHEN password_hash IS NOT NULL AND password_hash != '' THEN '✅ Password set'
    ELSE '❌ No password'
  END AS password_status
FROM public.profiles
WHERE id = 'b9afb855-0f85-44f4-af79-afe476d7d1bf'::uuid;
