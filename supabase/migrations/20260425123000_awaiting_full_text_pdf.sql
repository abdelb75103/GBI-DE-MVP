-- Allow title/abstract-included records to enter full-text screening before
-- the PDF is available. These rows must be explicitly marked in metadata and
-- are blocked from PDF-dependent review actions until a file is attached.

alter table public.screening_records
  drop constraint if exists screening_records_full_text_file_source_chk;

alter table public.screening_records
  add constraint screening_records_full_text_file_source_chk
  check (
    stage <> 'full_text'
    or (storage_bucket is not null and storage_object_path is not null)
    or data_base64 is not null
    or metadata->>'awaitingFullTextPdf' = 'true'
  );
