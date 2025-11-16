-- ============================================================================
-- VERIFY LAUNCH SETUP
-- ============================================================================
-- 
-- Run this script after clearing test data and setting up passwords
-- to verify everything is ready for production launch.
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard > SQL Editor
-- 2. Copy-paste this ENTIRE file
-- 3. Click "Run"
-- 4. Review all checks - they should all show ✅
--
-- ============================================================================

-- Check test data is cleared
DO $$
DECLARE
  papers_count INTEGER;
  paper_files_count INTEGER;
  paper_notes_count INTEGER;
  extractions_count INTEGER;
  extraction_fields_count INTEGER;
  population_groups_count INTEGER;
  population_values_count INTEGER;
  export_jobs_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO papers_count FROM public.papers;
  SELECT COUNT(*) INTO paper_files_count FROM public.paper_files;
  SELECT COUNT(*) INTO paper_notes_count FROM public.paper_notes;
  SELECT COUNT(*) INTO extractions_count FROM public.extractions;
  SELECT COUNT(*) INTO extraction_fields_count FROM public.extraction_fields;
  SELECT COUNT(*) INTO population_groups_count FROM public.population_groups;
  SELECT COUNT(*) INTO population_values_count FROM public.population_values;
  SELECT COUNT(*) INTO export_jobs_count FROM public.export_jobs;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST DATA CLEARANCE CHECK ===';
  RAISE NOTICE 'Papers: %', CASE WHEN papers_count = 0 THEN '✅ 0' ELSE '❌ ' || papers_count END;
  RAISE NOTICE 'Paper Files: %', CASE WHEN paper_files_count = 0 THEN '✅ 0' ELSE '❌ ' || paper_files_count END;
  RAISE NOTICE 'Paper Notes: %', CASE WHEN paper_notes_count = 0 THEN '✅ 0' ELSE '❌ ' || paper_notes_count END;
  RAISE NOTICE 'Extractions: %', CASE WHEN extractions_count = 0 THEN '✅ 0' ELSE '❌ ' || extractions_count END;
  RAISE NOTICE 'Extraction Fields: %', CASE WHEN extraction_fields_count = 0 THEN '✅ 0' ELSE '❌ ' || extraction_fields_count END;
  RAISE NOTICE 'Population Groups: %', CASE WHEN population_groups_count = 0 THEN '✅ 0' ELSE '❌ ' || population_groups_count END;
  RAISE NOTICE 'Population Values: %', CASE WHEN population_values_count = 0 THEN '✅ 0' ELSE '❌ ' || population_values_count END;
  RAISE NOTICE 'Export Jobs: %', CASE WHEN export_jobs_count = 0 THEN '✅ 0' ELSE '❌ ' || export_jobs_count END;
END $$;

-- Check profiles and auth.users
DO $$
DECLARE
  profiles_count INTEGER;
  auth_users_count INTEGER;
  profiles_without_auth INTEGER;
BEGIN
  SELECT COUNT(*) INTO profiles_count FROM public.profiles;
  SELECT COUNT(*) INTO auth_users_count FROM auth.users;
  SELECT COUNT(*) INTO profiles_without_auth
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE au.id IS NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== AUTHENTICATION SETUP CHECK ===';
  RAISE NOTICE 'Total Profiles: %', profiles_count;
  RAISE NOTICE 'Auth Users Created: %', auth_users_count;
  RAISE NOTICE 'Profiles Missing Auth: %', 
    CASE WHEN profiles_without_auth = 0 THEN '✅ 0 (all have auth.users)' ELSE '❌ ' || profiles_without_auth END;
END $$;

-- Show detailed profile/auth status
SELECT 
  p.full_name,
  p.role,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_auth,
  au.email as auth_email,
  CASE 
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '⚠️  Not confirmed'
  END as email_status
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.full_name;

-- Final summary
DO $$
DECLARE
  papers_count INTEGER;
  export_jobs_count INTEGER;
  profiles_count INTEGER;
  auth_users_count INTEGER;
  profiles_without_auth INTEGER;
  all_checks_passed BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO papers_count FROM public.papers;
  SELECT COUNT(*) INTO export_jobs_count FROM public.export_jobs;
  SELECT COUNT(*) INTO profiles_count FROM public.profiles;
  SELECT COUNT(*) INTO auth_users_count FROM auth.users;
  SELECT COUNT(*) INTO profiles_without_auth
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE au.id IS NULL;
  
  all_checks_passed := (
    papers_count = 0 AND
    export_jobs_count = 0 AND
    profiles_count > 0 AND
    auth_users_count = profiles_count AND
    profiles_without_auth = 0
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL VERIFICATION ===';
  
  IF all_checks_passed THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED - READY FOR LAUNCH!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Share passwords securely with users';
    RAISE NOTICE '2. Test profile selection in the app';
    RAISE NOTICE '3. Verify dashboard loads correctly';
    RAISE NOTICE '4. Ready to start uploading production papers!';
  ELSE
    RAISE WARNING '⚠️  SOME CHECKS FAILED - REVIEW ABOVE';
    RAISE NOTICE '';
    RAISE NOTICE 'Issues found:';
    IF papers_count > 0 THEN
      RAISE NOTICE '  - Test papers still exist (% remaining)', papers_count;
    END IF;
    IF export_jobs_count > 0 THEN
      RAISE NOTICE '  - Export jobs still exist (% remaining)', export_jobs_count;
    END IF;
    IF profiles_without_auth > 0 THEN
      RAISE NOTICE '  - Profiles missing auth.users entries (% profiles)', profiles_without_auth;
    END IF;
  END IF;
END $$;













