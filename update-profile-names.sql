-- ============================================================================
-- UPDATE PROFILE NAMES
-- ============================================================================
-- 
-- This script updates profile names:
-- - Ayman → Eamonn Hameid
-- - Jamal → Jamal Alskary
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard > SQL Editor
-- 2. Copy-paste this ENTIRE file
-- 3. Click "Run"
-- 4. Verify the changes below
--
-- ============================================================================

BEGIN;

-- Update Ayman to Eamonn Hameid
UPDATE public.profiles
SET 
  full_name = 'Eamonn Hameid',
  updated_at = now()
WHERE full_name = 'Ayman';

-- Update Jamal to Jamal Alskary
UPDATE public.profiles
SET 
  full_name = 'Jamal Alskary',
  updated_at = now()
WHERE full_name = 'Jamal';

-- Update auth.users raw_user_meta_data for Ayman
UPDATE auth.users
SET 
  raw_user_meta_data = jsonb_build_object('full_name', 'Eamonn Hameid'),
  updated_at = now()
WHERE raw_user_meta_data->>'full_name' = 'Ayman';

-- Update auth.users raw_user_meta_data for Jamal
UPDATE auth.users
SET 
  raw_user_meta_data = jsonb_build_object('full_name', 'Jamal Alskary'),
  updated_at = now()
WHERE raw_user_meta_data->>'full_name' = 'Jamal';

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show updated profiles
SELECT 
  p.id,
  p.full_name,
  p.role,
  au.email as auth_email,
  au.raw_user_meta_data->>'full_name' as auth_full_name
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.full_name IN ('Eamonn Hameid', 'Jamal Alskary')
ORDER BY p.full_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Profile names updated successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated profiles:';
  RAISE NOTICE '  - Ayman → Eamonn Hameid';
  RAISE NOTICE '  - Jamal → Jamal Alskary';
END $$;

