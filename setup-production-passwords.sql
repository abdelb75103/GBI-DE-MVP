-- ============================================================================
-- SETUP PRODUCTION PASSWORDS FOR ALL PROFILES
-- ============================================================================
-- 
-- This script creates auth.users entries with secure passwords for all profiles
-- in the profiles table. Passwords are hashed using bcrypt.
--
-- INSTRUCTIONS:
-- 1. First, run clear-test-data.sql to clean the database
-- 2. Review the profiles list below and update passwords if needed
-- 3. Go to your Supabase Dashboard > SQL Editor
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run" (or press Cmd/Ctrl + Enter)
-- 6. Review the verification output at the end
--
-- SECURITY:
-- - Passwords are hashed using pgcrypto (bcrypt algorithm)
-- - Default passwords are strong but should be changed by users
-- - Store passwords securely and share via secure channel
--
-- ============================================================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PASSWORD GENERATION
-- ============================================================================
-- 
-- Default passwords generated for each profile:
-- Format: [FirstName][Year]@FIFA[SpecialChar]
-- Example: AbdelRahman2025@FIFA!
--
-- IMPORTANT: These are default passwords. Users should change them after first login.
-- Share passwords securely with each user individually.
--
-- ============================================================================

DO $$
DECLARE
  instance_uuid UUID;
  profile_record RECORD;
  password_hash TEXT;
  email_address TEXT;
  username_part TEXT;
  name_parts TEXT[];
  first_real_name TEXT;
  title_pattern TEXT := '^(dr|doctor|prof|professor|mr|mrs|ms|miss)\.?$';
  i INTEGER;
BEGIN
  -- Get the instance_id from an existing user (or use a default)
  SELECT COALESCE(
    (SELECT u.instance_id FROM auth.users u LIMIT 1), 
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO instance_uuid;

  -- Loop through all profiles and create auth.users entries
  FOR profile_record IN 
    SELECT id, full_name, role 
    FROM public.profiles 
    ORDER BY full_name
  LOOP
    -- Extract username from full name
    -- Skip common titles: Dr, Dr., Professor, Prof, Prof., Mr, Mrs, Ms, etc.
    -- Split name into parts
    name_parts := STRING_TO_ARRAY(LOWER(TRIM(profile_record.full_name)), ' ');
    
    -- Find first non-title word
    first_real_name := NULL;
    FOR i IN 1..ARRAY_LENGTH(name_parts, 1) LOOP
      IF name_parts[i] !~ title_pattern THEN
        first_real_name := name_parts[i];
        EXIT;
      END IF;
    END LOOP;
    
    -- Fallback to first word if all are titles
    IF first_real_name IS NULL THEN
      first_real_name := name_parts[1];
    END IF;
    
    -- Clean up: remove special chars, keep only letters and numbers
    username_part := REGEXP_REPLACE(first_real_name, '[^a-z0-9]', '', 'g');
    
    -- Generate email address
    email_address := username_part || '@fifa-gbi.local';
    
    -- Generate password hash
    -- Default password format: [FirstName]2025@FIFA!
    -- Example: abdelrahman2025@FIFA!
    password_hash := crypt(
      username_part || '2025@FIFA!',
      gen_salt('bf', 10)
    );
    
    -- Create auth.users entry
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
      profile_record.id,
      instance_uuid,
      email_address,
      password_hash,
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', profile_record.full_name),
      false,
      'authenticated'
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = profile_record.id)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      updated_at = now(),
      raw_user_meta_data = EXCLUDED.raw_user_meta_data;
    
    RAISE NOTICE 'Created/updated auth.users entry for: % (%)', 
      profile_record.full_name, email_address;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ All auth.users entries created/updated successfully';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all profiles with their auth.users status
SELECT 
  p.id,
  p.full_name,
  p.role,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Has auth.users entry'
    ELSE '❌ Missing auth.users entry'
  END as auth_status,
  au.email as auth_email,
  au.email_confirmed_at IS NOT NULL as email_confirmed
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.full_name;

-- ============================================================================
-- PASSWORD REFERENCE (for admin use - store securely!)
-- ============================================================================
-- 
-- Default passwords for each user (format: [firstname]2025@FIFA!)
-- 
-- Example passwords (replace [firstname] with actual first name):
-- - abdelrahman2025@FIFA!
-- - amr2025@FIFA!
-- - ayman2025@FIFA!
-- - jamal2025@FIFA!
-- - sadeer2025@FIFA!
-- - ben2025@FIFA!
-- - nicol2025@FIFA!
-- - eamonn2025@FIFA!
--
-- IMPORTANT: 
-- - Share these passwords securely with each user
-- - Users should change passwords after first login
-- - Store this list in a secure password manager
-- - Do NOT commit passwords to version control
--
-- ============================================================================

