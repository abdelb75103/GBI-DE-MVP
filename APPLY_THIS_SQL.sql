-- ============================================================================
-- SUPABASE MIGRATION: Complete Database Setup
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run" (or press Cmd/Ctrl + Enter)
-- 6. All test data has already been cleared
--
-- ============================================================================

-- Extension
create extension if not exists "pgcrypto";

-- ============================================================================
-- MIGRATION 1: Extraction Schema
-- ============================================================================

-- Create extraction_tab enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'extraction_tab') then
    create type extraction_tab as enum (
      'studyDetails',
      'participantCharacteristics',
      'definitions',
      'exposure',
      'injuryOutcome',
      'illnessOutcome',
      'injuryTissueType',
      'injuryLocation',
      'illnessRegion',
      'illnessEtiology'
    );
  end if;
end $$;

-- Drop old enum if it exists
do $$
begin
  if exists (select 1 from pg_type where typname = 'extraction_updated_by') then
    drop type extraction_updated_by CASCADE;
    raise notice 'Dropped old extraction_updated_by enum';
  end if;
end $$;

-- Papers table modifications
alter table if exists public.papers
  add column if not exists assigned_study_id text unique,
  add column if not exists flag_reason text,
  add column if not exists status public.paper_status default 'uploaded',
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists papers_assigned_study_id_idx on public.papers (assigned_study_id);

comment on column public.papers.assigned_study_id is 'Human-readable study identifier (e.g., S001, S002) automatically assigned';

-- Paper files table
create table if not exists public.paper_files (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  name text not null,
  size bigint not null,
  mime_type text not null,
  uploaded_at timestamptz not null default now(),
  storage_bucket text,
  storage_object_path text,
  public_url text,
  data_base64 text
);

create index if not exists paper_files_paper_id_idx on public.paper_files (paper_id);

-- Paper notes table
create table if not exists public.paper_notes (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists paper_notes_paper_id_idx on public.paper_notes (paper_id);

comment on table public.paper_notes is 'Notes are written by the person assigned to the paper';

-- Extractions table
create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  tab extraction_tab not null,
  model text not null default 'human-input',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists extractions_paper_tab_idx
  on public.extractions (paper_id, tab);

-- Extraction fields table (updated_by is now TEXT, not enum)
create table if not exists public.extraction_fields (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references public.extractions (id) on delete cascade,
  field_id text not null,
  value text,
  confidence numeric,
  source_quote text,
  page_hint text,
  metric public.extraction_metric,
  status public.extraction_field_status not null default 'not_reported',
  updated_at timestamptz not null default now(),
  updated_by text
);

create unique index if not exists extraction_fields_unique_field
  on public.extraction_fields (extraction_id, field_id);

comment on column public.extraction_fields.updated_by is 'Profile ID of user who last updated this field, or NULL for system/AI updates';

-- Population groups table
create table if not exists public.population_groups (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  tab extraction_tab not null default 'participantCharacteristics',
  label text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists population_groups_unique_position
  on public.population_groups (paper_id, tab, position);

-- Population values table
create table if not exists public.population_values (
  id uuid primary key default gen_random_uuid(),
  population_group_id uuid not null references public.population_groups (id) on delete cascade,
  paper_id uuid not null references public.papers (id) on delete cascade,
  field_id text not null,
  value text,
  metric public.extraction_metric,
  unit text,
  source_field_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists population_values_group_idx
  on public.population_values (population_group_id);

create index if not exists population_values_field_idx
  on public.population_values (paper_id, field_id);

-- Export jobs table
create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  kind public.export_kind not null,
  paper_ids uuid[] not null,
  status public.export_status not null default 'ready',
  created_at timestamptz not null default now(),
  checksum_sha256 text,
  download_path text
);

create index if not exists export_jobs_created_idx on public.export_jobs (created_at desc);

-- ============================================================================
-- MIGRATION 2: Paper Assignment Tracking
-- ============================================================================

alter table if exists public.papers
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

create index if not exists papers_assigned_to_idx on public.papers (assigned_to);

comment on column public.papers.assigned_to is 'Profile ID of the user currently assigned to work on this paper';

-- ============================================================================
-- MIGRATION 3: Simplify Notes
-- ============================================================================

-- Drop old author columns
alter table if exists public.paper_notes
  drop column if exists author_id;

alter table if exists public.paper_notes
  drop column if exists author;

drop index if exists public.paper_notes_author_id_idx;

comment on table public.paper_notes is 'Notes are written by the person assigned to the paper';

-- ============================================================================
-- COMPLETE!
-- ============================================================================

-- Verify the setup
select 'Migration complete! ✅' as status;

-- Show what was created/modified
select 
  'extraction_fields.updated_by is now TEXT (stores profile IDs)' as change
union all
select 
  'Old extraction_updated_by enum has been removed' as change
union all
select 
  'papers.assigned_to column added for session tracking' as change
union all
select 
  'papers.assigned_study_id column added' as change
union all
select 
  'paper_notes.author column removed' as change;

