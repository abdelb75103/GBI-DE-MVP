-- ============================================================================
-- SETUP PROFILE PASSWORDS
-- ============================================================================
-- 
-- This script generates random secure passwords and hashes them for all profiles
-- in the profiles table. Passwords are hashed using bcrypt via pgcrypto.
--
-- INSTRUCTIONS:
-- 1. Make sure the migration 20250215000000_add_profile_passwords.sql has been run
-- 2. Go to your Supabase Dashboard > SQL Editor
-- 3. Copy-paste this ENTIRE file
-- 4. Click "Run" (or press Cmd/Ctrl + Enter)
-- 5. Review the password list at the end and store it securely
--
-- SECURITY:
-- - Passwords are randomly generated (10 characters, secure format)
-- - Passwords are hashed using pgcrypto (bcrypt algorithm, 10 rounds)
-- - Plaintext passwords are shown in output for secure distribution
-- - Share passwords securely with each user individually
--
-- ============================================================================

-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PASSWORD GENERATION FUNCTION
-- ============================================================================
-- 
-- Generates a random 10-character password with:
-- - Uppercase letters (excluding I and O)
-- - Lowercase letters (excluding l and o)
-- - Numbers (excluding 0 and 1)
-- - Special characters (!@#$%&*)
--

CREATE OR REPLACE FUNCTION generate_random_password()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  uppercase text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  lowercase text := 'abcdefghijkmnpqrstuvwxyz';
  numbers text := '23456789';
  special text := '!@#$%&*';
  all_chars text;
  password text := '';
  password_array text[];
  i integer;
  j integer;
  temp_char text;
BEGIN
  -- Ensure at least one character from each category
  password := password || substr(uppercase, floor(random() * length(uppercase))::integer + 1, 1);
  password := password || substr(lowercase, floor(random() * length(lowercase))::integer + 1, 1);
  password := password || substr(numbers, floor(random() * length(numbers))::integer + 1, 1);
  password := password || substr(special, floor(random() * length(special))::integer + 1, 1);
  
  -- Combine all characters
  all_chars := uppercase || lowercase || numbers || special;
  
  -- Fill the rest randomly
  FOR i IN 5..10 LOOP
    password := password || substr(all_chars, floor(random() * length(all_chars))::integer + 1, 1);
  END LOOP;
  
  -- Convert to array for shuffling
  password_array := string_to_array(password, null);
  
  -- Shuffle the password array
  FOR i IN 1..10 LOOP
    j := floor(random() * 10)::integer + 1;
    temp_char := password_array[i];
    password_array[i] := password_array[j];
    password_array[j] := temp_char;
  END LOOP;
  
  -- Convert back to string
  password := array_to_string(password_array, '');
  
  RETURN password;
END;
$$;

-- ============================================================================
-- SET PASSWORDS FOR ALL PROFILES
-- ============================================================================

DO $$
DECLARE
  profile_record RECORD;
  plain_password TEXT;
  password_hash TEXT;
  password_list TEXT := E'\n';
BEGIN
  -- Loop through all profiles and set passwords
  FOR profile_record IN 
    SELECT id, full_name, role 
    FROM public.profiles 
    WHERE password_hash IS NULL OR password_hash = ''
    ORDER BY full_name
  LOOP
    -- Generate random password
    plain_password := generate_random_password();
    
    -- Hash the password using bcrypt
    password_hash := crypt(plain_password, gen_salt('bf', 10));
    
    -- Update the profile with the password hash
    UPDATE public.profiles
    SET password_hash = password_hash,
        updated_at = now()
    WHERE id = profile_record.id;
    
    -- Add to password list for output
    password_list := password_list || 
      format('  %s: %s\n', profile_record.full_name, plain_password);
    
    RAISE NOTICE 'Set password for: %', profile_record.full_name;
  END LOOP;
  
  -- Output password list
  RAISE NOTICE E'\n========================================\n';
  RAISE NOTICE 'GENERATED PASSWORDS (STORE SECURELY):';
  RAISE NOTICE E'========================================\n';
  RAISE NOTICE '%', password_list;
  RAISE NOTICE E'========================================\n';
  RAISE NOTICE '✅ All passwords set successfully';
  RAISE NOTICE E'========================================\n';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all profiles with password status
SELECT 
  id,
  full_name,
  role,
  CASE 
    WHEN password_hash IS NOT NULL AND password_hash != '' THEN '✅ Password set'
    ELSE '❌ No password'
  END as password_status,
  length(password_hash) as hash_length
FROM public.profiles
ORDER BY full_name;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- IMPORTANT: The passwords shown in the NOTICE output above are plaintext.
-- Store them securely and share with each user individually.
--
-- Password format:
-- - Length: 10 characters
-- - Contains: Uppercase, lowercase, numbers, and special characters
-- - Randomly generated (not predictable)
--
-- To reset a password for a specific profile:
-- UPDATE public.profiles
-- SET password_hash = crypt('newpassword', gen_salt('bf', 10))
-- WHERE id = 'profile-uuid-here';
--
-- ============================================================================

