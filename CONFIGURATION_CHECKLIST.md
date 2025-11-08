# Configuration Checklist for Supabase Integration

## ✅ Fixed Issues

1. **Type Definition Error** - FIXED ✅
   - Removed `extraction_updated_by` from Enums in `types.ts`
   - This enum no longer exists in the database (we now use profile IDs as text)

## 🔍 Required Actions

### 1. Apply Database Migrations

Your code changes are ready, but you **MUST** run the migrations against your Supabase database:

```bash
# Option A: Using Supabase CLI (recommended)
supabase migration up

# Option B: Manually in Supabase Dashboard
# Go to SQL Editor and run each migration file in order:
```

**Migration files to apply** (in this order):
1. `supabase/migrations/20250214120000_extraction_schema.sql`
2. `supabase/migrations/20250214140000_paper_assignment.sql`
3. `supabase/migrations/20250214150000_simplify_notes.sql`

**Critical changes in migrations:**
- ✅ Removed `extraction_updated_by` enum (now uses text for profile IDs)
- ✅ Changed `extraction_fields.updated_by` from enum to `text`
- ✅ Added `papers.assigned_to` column for session management
- ✅ Added `papers.assigned_study_id` column
- ✅ Removed `author` column from `paper_notes`
- ✅ Added proper indexes and comments

### 2. Verify Environment Variables

Check that these are set in your environment:

**Required for all environments:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key

**Required for server-side operations:**
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)

**Where to set these:**
- Local development: `.env.local` file in the root directory
- Production: Your hosting platform's environment variables

### 3. Data Migration Considerations

⚠️ **IMPORTANT**: If you have existing data in `extraction_fields` table:

The `updated_by` column previously stored enum values ('human' or 'ai'), but now needs to store profile IDs (UUIDs as text).

**Options:**
1. **Fresh start**: If your data is not important, reset the database
2. **Migrate data**: Run this SQL to clean existing data:
   ```sql
   -- Clear existing updated_by values (they're old enum values)
   UPDATE extraction_fields SET updated_by = NULL WHERE updated_by IN ('human', 'ai');
   
   -- Or delete all extraction_fields if you want a clean slate
   -- TRUNCATE extraction_fields CASCADE;
   ```

### 4. Database Enum Cleanup

⚠️ If the old `extraction_updated_by` enum still exists in your database, remove it:

```sql
-- Check if enum exists
SELECT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'extraction_updated_by'
);

-- If it exists, drop it (after data migration)
DROP TYPE IF EXISTS extraction_updated_by CASCADE;
```

### 5. Verify Core Enums Exist

Run this in Supabase SQL Editor to ensure all required enums exist:

```sql
-- Check for required enums
SELECT typname FROM pg_type WHERE typname IN (
  'user_role',
  'paper_status',
  'assignment_status',
  'extraction_field_status',
  'extraction_metric',
  'export_kind',
  'export_status',
  'extraction_tab'
);

-- Should return 8 rows (all the enums listed above)
```

## 🧪 Testing Checklist

After migrations are applied, test these operations:

1. **Create a paper** (POST `/api/papers`)
   - Should track `uploaded_by` profile ID
   - Should require authentication

2. **Start a session** (`mockDb.startPaperSession`)
   - Should set `assigned_to` column
   - Should prevent concurrent sessions

3. **Save extraction fields** (POST `/api/extract/save`)
   - Should store profile ID in `updated_by` field (not 'human' or 'ai')
   - Should properly track which user made changes

4. **Check the database**:
   ```sql
   -- Verify extraction_fields.updated_by contains profile IDs
   SELECT field_id, value, updated_by 
   FROM extraction_fields 
   WHERE updated_by IS NOT NULL 
   LIMIT 5;
   
   -- updated_by should be UUIDs, not 'human' or 'ai'
   ```

## 🚨 Common Issues

### Issue 1: "Type 'extraction_updated_by' does not exist"
**Solution**: The old enum still exists in your database. Drop it as shown in step 4 above.

### Issue 2: "Column 'author' does not exist in table 'paper_notes'"
**Solution**: Run migration `20250214150000_simplify_notes.sql` to remove the author column.

### Issue 3: "Invalid input value for enum extraction_updated_by"
**Solution**: Your code is trying to insert enum values into a text field. Ensure all code is using the latest version (profile IDs, not 'human'/'ai').

### Issue 4: "Supabase credentials are not configured"
**Solution**: Set the required environment variables listed in step 2.

## ✅ Verification Commands

Run these to verify everything is configured correctly:

```bash
# Check environment variables are set
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
echo $SUPABASE_SERVICE_ROLE_KEY

# Build the app (will catch TypeScript errors)
npm run build

# Run linter
npm run lint
```

### 6. Supabase Storage Bucket Setup

⚠️ **REQUIRED**: Create and configure the `papers` storage bucket for PDF file storage:

**Steps to create the bucket:**

1. Go to your Supabase Dashboard → Storage
2. Click "Create a new bucket"
3. Name: `papers`
4. **Public bucket**: ❌ **UNCHECKED** (keep it private for security)
5. Click "Create bucket"

**Configure bucket policies:**

After creating the bucket, set up Row Level Security (RLS) policies:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'papers');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'papers');

-- Allow service role to manage all files (for server-side operations)
CREATE POLICY "Allow service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'papers')
WITH CHECK (bucket_id = 'papers');
```

**Alternative: Use Supabase Dashboard**
1. Go to Storage → `papers` bucket → Policies
2. Click "New Policy"
3. Create policies for:
   - **INSERT**: Allow authenticated users
   - **SELECT**: Allow authenticated users
   - **ALL**: Allow service_role (for admin operations)

**Verify bucket exists:**
```sql
-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'papers';
```

**Test upload:**
After setup, try uploading a PDF through the app. If it fails, check:
- Bucket name is exactly `papers` (case-sensitive)
- Service role key is set in environment variables
- RLS policies are properly configured

## 📋 Summary

**Code Status**: ✅ All code is properly configured and synchronized

**Database Status**: ⚠️ NEEDS ATTENTION - You must:
1. Apply the 3 migration files to your Supabase database
2. Clean up existing data if necessary
3. Verify the old `extraction_updated_by` enum is removed

**Storage Status**: ⚠️ NEEDS ATTENTION - You must:
1. Create the `papers` storage bucket
2. Configure RLS policies for authenticated access
3. Verify service role has access

**Environment**: ⚠️ VERIFY - Ensure all environment variables are set

---

## Next Steps

1. ✅ Apply migrations to Supabase
2. ✅ Set environment variables
3. ✅ Create and configure `papers` storage bucket
4. ✅ Clean up existing data (if needed)
5. ✅ Run tests
6. ✅ Deploy

If you encounter any errors, check the "Common Issues" section above.

