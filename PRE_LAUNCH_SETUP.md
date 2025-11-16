# Pre-Launch Setup Guide

This guide walks you through clearing test data and setting up passwords for production launch.

## Step 1: Clear Test Data

### Option A: Using SQL Script (Recommended)

1. Open your [Supabase Dashboard](https://app.supabase.com)
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Open the file: `clear-test-data.sql` (in the root folder)
5. Copy **ALL the SQL** from that file
6. Paste it into the Supabase SQL Editor
7. Click **"Run"** (or press Cmd+Enter / Ctrl+Enter)

You should see verification output showing all data cleared.

### Option B: Using Node.js Script

```bash
cd fifa-gbi-data-extraction
node ../clear-test-data.mjs
```

**Note:** Requires `@supabase/supabase-js` to be installed. If you get module errors, use Option A instead.

## Step 2: Set Up Passwords for All Profiles

### Generate Passwords

The SQL script (`setup-production-passwords.sql`) will automatically generate passwords for all profiles using the format:
- **Format:** `[firstname]2025@FIFA!`
- **Example:** `abdelrahman2025@FIFA!` for AbdelRahman

### Create auth.users Entries

1. Open your [Supabase Dashboard](https://app.supabase.com)
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Open the file: `setup-production-passwords.sql` (in the root folder)
5. Copy **ALL the SQL** from that file
6. Paste it into the Supabase SQL Editor
7. Click **"Run"** (or press Cmd+Enter / Ctrl+Enter)

The script will:
- Create `auth.users` entries for all profiles in the `profiles` table
- Generate secure password hashes using bcrypt
- Set email addresses in format: `[firstname]@fifa-gbi.local`
- Link `auth.users.id` to `profiles.id`

### Verify Setup

After running the script, check the verification output. You should see:
- ✅ All profiles have auth.users entries
- Email addresses listed for each user
- Email confirmed status

## Step 3: Document Passwords Securely

### Password Format

For each profile, the default password follows this pattern:
```
[firstname]2025@FIFA!
```

Where `[firstname]` is the lowercase first name from the profile's full name.

### Example Passwords

Based on the profiles in your system:

1. **AbdelRahman** (admin)
   - Email: `abdelrahman@fifa-gbi.local`
   - Password: `abdelrahman2025@FIFA!`

2. **Amr** (extractor)
   - Email: `amr@fifa-gbi.local`
   - Password: `amr2025@FIFA!`

3. **Ayman** (extractor)
   - Email: `ayman@fifa-gbi.local`
   - Password: `ayman2025@FIFA!`

4. **Jamal** (extractor)
   - Email: `jamal@fifa-gbi.local`
   - Password: `jamal2025@FIFA!`

5. **Sadeer** (extractor)
   - Email: `sadeer@fifa-gbi.local`
   - Password: `sadeer2025@FIFA!`

6. **Dr. Ben Clarsen** (project lead)
   - Email: `ben@fifa-gbi.local`
   - Password: `ben2025@FIFA!`

7. **Dr. Nicol van Dyk** (project lead)
   - Email: `nicol@fifa-gbi.local`
   - Password: `nicol2025@FIFA!`

8. **Professor Eamonn Delahunt** (project lead)
   - Email: `eamonn@fifa-gbi.local`
   - Password: `eamonn2025@FIFA!`

### Security Notes

⚠️ **IMPORTANT:**
- Store these passwords in a secure password manager
- Share passwords with users via secure channel (not email)
- Users should change passwords after first login
- Do NOT commit passwords to version control
- Consider using a password manager to generate and store unique passwords

## Step 4: Verify Everything Works

### Check Database State

Run this query in Supabase SQL Editor to verify:

```sql
-- Check test data is cleared
SELECT 
  (SELECT COUNT(*) FROM papers) as papers_count,
  (SELECT COUNT(*) FROM export_jobs) as exports_count,
  (SELECT COUNT(*) FROM profiles) as profiles_count,
  (SELECT COUNT(*) FROM auth.users) as auth_users_count;

-- Should show:
-- papers_count: 0
-- exports_count: 0
-- profiles_count: 8 (or your actual count)
-- auth_users_count: 8 (or matching profiles_count)
```

### Check Profile Selection Still Works

1. Start your dev server: `npm run dev`
2. Navigate to the app
3. Verify profile selection page loads
4. Verify all profiles are listed
5. Select a profile and verify dashboard loads

## Troubleshooting

### Issue: Script fails with "permission denied"

**Solution:** Make sure you're using the Service Role Key in your `.env.local` file, not the anon key.

### Issue: auth.users entries not created

**Solution:** 
- Check that `pgcrypto` extension is enabled
- Verify profile IDs are valid UUIDs
- Check Supabase logs for detailed error messages

### Issue: Passwords don't work

**Solution:**
- Verify password format matches: `[firstname]2025@FIFA!`
- Check that first name extraction is correct
- Verify password hash was created correctly

### Issue: Profile selection shows errors

**Solution:**
- Verify profiles table still has data
- Check that profile IDs match auth.users entries
- Clear browser cookies and try again

## Next Steps

After completing this setup:

1. ✅ Test data is cleared
2. ✅ Passwords are set up
3. ✅ auth.users entries created
4. ✅ App is ready for production use

**Note:** The app currently uses profile selection (no login required). The passwords are set up for future login implementation. Users can continue using profile selection for now.

## Files Reference

- `clear-test-data.sql` - Clears all test data
- `setup-production-passwords.sql` - Creates auth.users entries with passwords
- `PRE_LAUNCH_SETUP.md` - This guide

---

**Ready to launch!** 🚀













