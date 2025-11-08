-- ============================================================================
-- CLEAR ALL TEST DATA FROM SUPABASE
-- ============================================================================
-- 
-- This script removes all test data from the database, leaving it in a clean
-- state for production deployment. The database schema and structure remain
-- intact - only data is removed.
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run" (or press Cmd/Ctrl + Enter)
-- 6. Review the verification output at the end
--
-- WARNING: This will permanently delete all test data. Make sure you have
-- backups if you need to recover any data later.
--
-- ============================================================================

-- Show current data counts before deletion
DO $$
DECLARE
  papers_count INTEGER;
  export_jobs_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO papers_count FROM public.papers;
  SELECT COUNT(*) INTO export_jobs_count FROM public.export_jobs;
  
  RAISE NOTICE '=== BEFORE DELETION ===';
  RAISE NOTICE 'Papers: %', papers_count;
  RAISE NOTICE 'Export Jobs: %', export_jobs_count;
END $$;

-- ============================================================================
-- DELETE TEST DATA
-- ============================================================================

-- Delete all export jobs (standalone table, no foreign key dependencies)
DELETE FROM public.export_jobs;

-- Delete all papers
-- This will CASCADE delete all related data:
--   - paper_files (via paper_id foreign key with CASCADE)
--   - paper_notes (via paper_id foreign key with CASCADE)
--   - extractions (via paper_id foreign key with CASCADE)
--     - extraction_fields (via extraction_id foreign key with CASCADE)
--   - population_groups (via paper_id foreign key with CASCADE)
--     - population_values (via population_group_id and paper_id foreign keys with CASCADE)
DELETE FROM public.papers;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show data counts after deletion
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
  RAISE NOTICE '=== AFTER DELETION ===';
  RAISE NOTICE 'Papers: %', papers_count;
  RAISE NOTICE 'Paper Files: %', paper_files_count;
  RAISE NOTICE 'Paper Notes: %', paper_notes_count;
  RAISE NOTICE 'Extractions: %', extractions_count;
  RAISE NOTICE 'Extraction Fields: %', extraction_fields_count;
  RAISE NOTICE 'Population Groups: %', population_groups_count;
  RAISE NOTICE 'Population Values: %', population_values_count;
  RAISE NOTICE 'Export Jobs: %', export_jobs_count;
  RAISE NOTICE '';
  
  IF papers_count = 0 AND export_jobs_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All test data has been cleared!';
  ELSE
    RAISE WARNING '⚠️  WARNING: Some data still remains. Check the counts above.';
  END IF;
END $$;

-- ============================================================================
-- PRESERVED DATA
-- ============================================================================
-- 
-- The following tables are NOT cleared (preserved for production):
--   - profiles (user profiles)
--   - auth.users (authentication users)
--
-- If you need to clear these as well, you can manually delete them:
--   DELETE FROM public.profiles;
--   DELETE FROM auth.users;
--
-- ============================================================================

