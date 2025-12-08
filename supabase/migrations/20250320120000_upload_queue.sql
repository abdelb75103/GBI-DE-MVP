-- Queue incoming PDF uploads for admin approval

do $$
begin
  if not exists (select 1 from pg_type where typname = 'upload_queue_status') then
    create type public.upload_queue_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

create table if not exists public.paper_upload_queue (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text,
  storage_object_path text,
  data_base64 text,
  file_name text not null,
  original_file_name text,
  mime_type text not null,
  size bigint not null,
  file_sha256 text,
  title text not null,
  extracted_title text,
  lead_author text,
  journal text,
  year text,
  doi text,
  normalized_doi text,
  duplicate_key_v2 text,
  title_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  status public.upload_queue_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paper_id uuid references public.papers (id) on delete set null,
  notes text,
  constraint paper_upload_queue_file_source_chk
    check ((storage_bucket is not null and storage_object_path is not null) or data_base64 is not null)
);

create index if not exists paper_upload_queue_status_idx on public.paper_upload_queue (status, created_at desc);
create index if not exists paper_upload_queue_created_by_idx on public.paper_upload_queue (created_by);
create index if not exists paper_upload_queue_file_sha256_idx on public.paper_upload_queue (file_sha256);
