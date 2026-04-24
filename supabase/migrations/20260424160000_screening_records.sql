-- Shared screening records for title/abstract and full-text review.
-- V1 exposes full-text screening only, but the stage column keeps the
-- workflow reusable for title/abstract screening later.

create table if not exists public.screening_records (
  id uuid primary key default gen_random_uuid(),
  stage text not null default 'full_text' check (stage in ('title_abstract', 'full_text')),
  assigned_study_id text not null unique,
  title text not null,
  abstract text,
  lead_author text,
  journal text,
  year text,
  doi text,
  normalized_doi text,
  source_label text,
  source_record_id text,
  storage_bucket text,
  storage_object_path text,
  data_base64 text,
  file_name text,
  original_file_name text,
  mime_type text,
  size bigint,
  file_sha256 text,
  ai_status text not null default 'not_run' check (ai_status in ('not_run', 'running', 'completed', 'failed')),
  ai_suggested_decision text check (ai_suggested_decision in ('include', 'exclude')),
  ai_reason text,
  ai_evidence_quote text,
  ai_source_location text,
  ai_confidence numeric,
  ai_model text,
  ai_criteria_version text,
  ai_raw_response jsonb,
  ai_error text,
  ai_reviewed_at timestamptz,
  manual_decision text check (manual_decision in ('include', 'exclude')),
  manual_reason text,
  manual_decided_by uuid references public.profiles (id) on delete set null,
  manual_decided_at timestamptz,
  promoted_paper_id uuid references public.papers (id) on delete set null,
  promoted_by uuid references public.profiles (id) on delete set null,
  promoted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  constraint screening_records_full_text_file_source_chk
    check (
      stage <> 'full_text'
      or (storage_bucket is not null and storage_object_path is not null)
      or data_base64 is not null
    ),
  constraint screening_records_exclude_reason_chk
    check (manual_decision is distinct from 'exclude' or coalesce(nullif(trim(manual_reason), ''), '') <> '')
);

create index if not exists screening_records_stage_created_idx
  on public.screening_records (stage, created_at desc);

create index if not exists screening_records_manual_decision_idx
  on public.screening_records (manual_decision, created_at desc);

create index if not exists screening_records_ai_status_idx
  on public.screening_records (ai_status, created_at desc);

create index if not exists screening_records_file_sha256_idx
  on public.screening_records (file_sha256);

create index if not exists screening_records_promoted_paper_idx
  on public.screening_records (promoted_paper_id);
