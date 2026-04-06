# Add FIFA Data Status

Run this in the Supabase SQL Editor before trying to tag FIFA papers as `fifa_data`:

```sql
alter type public.paper_status add value if not exists 'fifa_data';
```

After the enum is added, run:

```bash
cd /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction
node scripts/tag-fifa-data-papers.mjs
```

This will retag the current FIFA-flagged papers whose `flag_reason` is `FIFA DATA`, `FIFA Data`, or `FIFA` into the new `fifa_data` status bucket.
