-- Extraction & population normalization schema
-- Creates storage for papers, files, extractions, notes, and normalized population entries.

create extension if not exists "pgcrypto";

-- Core enums ---------------------------------------------------------------

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

-- Removed extraction_updated_by enum - we now track actual user profiles instead

-- Papers -------------------------------------------------------------------

alter table if exists public.papers
  add column if not exists assigned_study_id text unique,
  add column if not exists flag_reason text,
  add column if not exists status public.paper_status default 'uploaded',
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists papers_assigned_study_id_idx on public.papers (assigned_study_id);

comment on column public.papers.assigned_study_id is 'Human-readable study identifier (e.g., S001, S002) automatically assigned';

-- Paper files --------------------------------------------------------------

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

-- Notes --------------------------------------------------------------------

create table if not exists public.paper_notes (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists paper_notes_paper_id_idx on public.paper_notes (paper_id);

comment on table public.paper_notes is 'Notes are written by the person assigned to the paper';

-- Extractions --------------------------------------------------------------

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

-- Population normalization -------------------------------------------------

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

-- Export jobs --------------------------------------------------------------

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

