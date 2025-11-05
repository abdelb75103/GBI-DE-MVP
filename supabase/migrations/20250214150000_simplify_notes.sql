-- Simplify notes - no need to track individual authors
-- Since only one person works on a paper at a time,
-- notes are just text written by whoever is assigned to the paper

-- Drop the author_id column if it exists
alter table if exists public.paper_notes
  drop column if exists author_id;

-- Drop the author column if it exists (for older schemas)
alter table if exists public.paper_notes
  drop column if exists author;

-- Drop the index if it exists
drop index if exists public.paper_notes_author_id_idx;

comment on table public.paper_notes is 'Notes are written by the person assigned to the paper';

