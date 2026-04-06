# Add No Exposure Status

Run this in the Supabase SQL Editor before trying to tag papers as `no_exposure`:

```sql
alter type public.paper_status add value if not exists 'no_exposure';
```
