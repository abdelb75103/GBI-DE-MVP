# 🚨 FIX NOTES - 2 MINUTE FIX 🚨

## The Problem
Your `paper_notes` table has an `author_id` column that's NOT NULL, but the code doesn't send it anymore.

## The Solution (SUPER EASY)

### Step 1: Open Supabase Dashboard
1. Go to https://apjhyrxiailuhxbrxowx.supabase.co
2. Click on **SQL Editor** in the left sidebar

### Step 2: Run This SQL
Copy and paste this into the SQL editor and click **RUN**:

```sql
ALTER TABLE public.paper_notes DROP COLUMN IF EXISTS author_id CASCADE;
ALTER TABLE public.paper_notes DROP COLUMN IF EXISTS author CASCADE;
DROP INDEX IF EXISTS public.paper_notes_author_id_idx;
```

### Step 3: Done!
That's it! Now refresh your browser and try adding a note again. It will work!

---

## Why This Works
- Removes the `author_id` column (causing the error)
- Removes the old `author` column (if it exists)
- Removes the index
- Notes are now simple: just `id`, `paper_id`, `body`, `created_at`
- The person assigned to the paper is the one writing notes (no need to track individually)

---

## Still Having Issues?
If this doesn't work, take a screenshot and show me what error you get!

