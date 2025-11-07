-- ============================================================================
-- CREATE PROJECT LEAD PROFILES
-- ============================================================================
-- 
-- This script creates auth.users and profiles for Ben Clarsen, Eamonn Delahunt, and Nicol van Dyk
-- with extractor role permissions, but they will display as "Project Lead" in the UI.
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run" (or press Cmd/Ctrl + Enter)
--
-- ============================================================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fixed UUIDs for consistency (these will be used for both auth.users and profiles)
DO $$
DECLARE
  ben_id UUID := '550e8400-e29b-41d4-a716-446655440001'::uuid;
  eamonn_id UUID := '550e8400-e29b-41d4-a716-446655440002'::uuid;
  nicol_id UUID := '550e8400-e29b-41d4-a716-446655440003'::uuid;
  instance_uuid UUID;
  temp_password TEXT;
BEGIN
  -- Get the instance_id from an existing user (or use a default)
  SELECT COALESCE((SELECT u.instance_id FROM auth.users u LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid) INTO instance_uuid;
  
  -- Generate a temporary password hash (users won't actually log in, this is just for the constraint)
  temp_password := crypt('temp-password-' || ben_id::text, gen_salt('bf'));
  
  -- Create auth.users entries first
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
    ben_id,
    instance_uuid,
    'ben.clarsen@fifa-gbi.local',
    temp_password,
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Dr. Ben Clarsen"}'::jsonb,
    false,
    'authenticated'
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ben_id)
  ON CONFLICT (id) DO NOTHING;

  temp_password := crypt('temp-password-' || eamonn_id::text, gen_salt('bf'));
  
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
    eamonn_id,
    instance_uuid,
    'eamonn.delahunt@fifa-gbi.local',
    temp_password,
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Professor Eamonn Delahunt"}'::jsonb,
    false,
    'authenticated'
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = eamonn_id)
  ON CONFLICT (id) DO NOTHING;

  temp_password := crypt('temp-password-' || nicol_id::text, gen_salt('bf'));
  
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
    nicol_id,
    instance_uuid,
    'nicol.vandyk@fifa-gbi.local',
    temp_password,
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Dr. Nicol van Dyk"}'::jsonb,
    false,
    'authenticated'
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = nicol_id)
  ON CONFLICT (id) DO NOTHING;

  -- Now create profiles with extractor role
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    preferred_email,
    created_at,
    updated_at
  )
  VALUES
    (
      ben_id,
      'Dr. Ben Clarsen',
      'extractor',
      NULL,
      now(),
      now()
    ),
    (
      eamonn_id,
      'Professor Eamonn Delahunt',
      'extractor',
      NULL,
      now(),
      now()
    ),
    (
      nicol_id,
      'Dr. Nicol van Dyk',
      'extractor',
      NULL,
      now(),
      now()
    )
  ON CONFLICT (id) 
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = now();

  RAISE NOTICE 'Project lead profiles created/updated successfully';
END $$;

-- Verify the profiles were created
SELECT 
  id,
  full_name,
  role,
  preferred_email,
  created_at
FROM public.profiles
WHERE id IN (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid
)
ORDER BY full_name;

