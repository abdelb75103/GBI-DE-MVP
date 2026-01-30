-- Track the latest reviewer decisions on AI extracted fields (approve/decline).
-- Stores the current decision state only (not a click/event log).

create table if not exists public.ai_review_decisions (
  paper_id uuid not null,
  tab public.extraction_tab not null,
  field_id text not null,
  decision text not null check (decision in ('approved', 'declined')),
  reviewer_profile_id uuid not null,
  constraint ai_review_decisions_paper_id_fkey foreign key (paper_id) references public.papers (id) on delete cascade,
  constraint ai_review_decisions_reviewer_profile_id_fkey foreign key (reviewer_profile_id) references public.profiles (id) on delete restrict
);

create unique index if not exists ai_review_decisions_unique_field
  on public.ai_review_decisions (paper_id, tab, field_id);

create index if not exists ai_review_decisions_tab_field_idx
  on public.ai_review_decisions (tab, field_id);

create index if not exists ai_review_decisions_reviewer_idx
  on public.ai_review_decisions (reviewer_profile_id);

