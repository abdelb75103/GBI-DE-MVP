# Pre-Launch Checklist

Complete this checklist before launching the FIFA GBI Data Extraction Assistant to production.

## Step 1: Clear Test Data ✅

- [ ] **Run `clear-test-data.sql` in Supabase Dashboard**
  - Go to Supabase Dashboard > SQL Editor
  - Copy-paste `clear-test-data.sql`
  - Click Run
  - Verify all counts show 0

**Expected Result:**
- ✅ Papers: 0
- ✅ Paper Files: 0
- ✅ Paper Notes: 0
- ✅ Extractions: 0
- ✅ Extraction Fields: 0
- ✅ Population Groups: 0
- ✅ Population Values: 0
- ✅ Export Jobs: 0

## Step 2: Set Up Passwords ✅

- [ ] **Run `setup-production-passwords.sql` in Supabase Dashboard**
  - Go to Supabase Dashboard > SQL Editor
  - Copy-paste `setup-production-passwords.sql`
  - Click Run
  - Review verification output

**Expected Result:**
- ✅ All profiles have auth.users entries
- ✅ Email addresses created (format: [firstname]@fifa-gbi.local)
- ✅ Passwords hashed and stored securely

## Step 3: Document Passwords Securely ✅

- [ ] **Create password list** (use `PASSWORDS_TEMPLATE.md` as reference)
- [ ] **Store passwords in secure password manager**
- [ ] **Share passwords with users via secure channel**
- [ ] **Do NOT commit passwords to git**

**Password Format:** `[firstname]2025@FIFA!`

**Example:**
- AbdelRahman → `abdelrahman2025@FIFA!`
- Dr. Ben Clarsen → `ben2025@FIFA!`

## Step 4: Verify Setup ✅

- [ ] **Run `verify-launch-setup.sql` in Supabase Dashboard**
  - Go to Supabase Dashboard > SQL Editor
  - Copy-paste `verify-launch-setup.sql`
  - Click Run
  - Review all checks

**Expected Result:**
- ✅ All test data cleared
- ✅ All profiles have auth.users entries
- ✅ Ready for launch message

## Step 5: Test Application ✅

- [ ] **Start dev server:** `npm run dev`
- [ ] **Navigate to app:** http://localhost:3000
- [ ] **Verify profile selection page loads**
- [ ] **Verify all profiles are listed**
- [ ] **Select a profile and verify dashboard loads**
- [ ] **Verify no test data appears**
- [ ] **Test navigation between pages**

## Step 6: Final Checks ✅

- [ ] **Environment variables configured** (.env.local)
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
- [ ] **API keys configured** (Gemini API key in Settings)
- [ ] **Database schema up to date**
- [ ] **No linting errors** (`npm run lint`)
- [ ] **Application builds successfully** (`npm run build`)

## Files Created

✅ **SQL Scripts:**
- `clear-test-data.sql` - Clears all test data
- `setup-production-passwords.sql` - Creates auth.users entries with passwords
- `verify-launch-setup.sql` - Verifies setup is complete

✅ **Documentation:**
- `PRE_LAUNCH_SETUP.md` - Step-by-step setup guide
- `PASSWORDS_TEMPLATE.md` - Password reference template
- `LAUNCH_CHECKLIST.md` - This checklist

## Security Reminders

⚠️ **IMPORTANT:**
- Passwords are stored as bcrypt hashes (never plaintext)
- Share passwords securely (not via email)
- Users should change passwords after first login
- Store password list in secure password manager
- Do NOT commit passwords to version control

## Current Status

- ✅ Test data clearing script ready
- ✅ Password setup script ready
- ✅ Verification script ready
- ✅ Documentation complete
- ⏳ **Ready to execute SQL scripts in Supabase**

## Next Steps

1. **Run SQL scripts** in Supabase Dashboard (in order):
   - `clear-test-data.sql`
   - `setup-production-passwords.sql`
   - `verify-launch-setup.sql`

2. **Document passwords** securely (use password manager)

3. **Test application** to verify everything works

4. **Share credentials** with users securely

5. **Launch!** 🚀

---

**Status:** ✅ **READY TO EXECUTE**

All scripts and documentation are prepared. Run the SQL scripts in Supabase Dashboard to complete the setup.


















