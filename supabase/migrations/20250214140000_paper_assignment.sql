-- Add paper assignment tracking
-- Allows tracking which profile is currently working on a paper

alter table if exists public.papers
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

create index if not exists papers_assigned_to_idx on public.papers (assigned_to);

comment on column public.papers.assigned_to is 'Profile ID of the user currently assigned to work on this paper';

