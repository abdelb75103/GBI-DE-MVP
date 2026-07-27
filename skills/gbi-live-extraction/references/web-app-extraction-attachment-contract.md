# Web App Extraction Attachment Contract

Use this reference before attaching or replacing a translated PDF on a live FIFA GBI extraction paper.

## Live Schema Constraint

The live `paper_files` table has a one-row-per-paper contract, enforced by the unique constraint `paper_files_paper_id_key`.

- Do not model the translated PDF as a second `paper_files` row.
- Do not discover this constraint by attempting an insert.
- Query the exact paper and its `paper_files` rows before any upload.
- Refuse the write when more than one row exists or the current file hash does not match the downloaded object.
- If an existing extraction paper has no file row, stop unless the task is explicitly creating its first attachment and the `papers` row has no conflicting source pointer.

The supported pattern is the same one used by `fifa-gbi-data-extraction/scripts/refresh-master-pdf.mjs`: upload a versioned successor object, update the existing file row in place, then update the paper's primary-file pointers.

Do not use `scripts/upload_merged_translated_pdfs_to_supabase.mjs` for an existing extraction paper. Its `paper_files` insert path is intended for initial record creation and will conflict with the live uniqueness constraint.

## Required Preflight

Resolve one exact target using `papers.assigned_study_id` plus the task's Covidence number or other requested identifier. Before uploading:

1. Read the `papers` row, its single `paper_files` row, assignment, status, metadata, and protected screening state.
2. Download the currently registered source object.
3. Verify the downloaded original SHA-256 equals both the registered file hash and the expected source hash.
4. Verify the merged PDF SHA-256 and confirm it contains the English translation first and the complete original second.
5. Save a pristine pre-apply snapshot containing the original file-row and paper-pointer values.

Stop before upload if target membership, assignment, current hashes, or file-row cardinality is unexpected.

The dry run must report `update_existing_file_row` or `create_first_file_row` explicitly, along with the original and merged hashes and storage paths. It must not defer file-row cardinality discovery until apply.

## Apply Order

Use an idempotent, resumable sequence:

1. Upload the merged PDF to a new deterministic versioned path with `upsert: false`.
2. If that path already exists after a retry, download it and reuse it only when its SHA-256 equals the staged merged PDF.
3. Guarded-update the existing `paper_files` row by its ID, paper ID, and expected original or already-merged SHA-256.
4. Guarded-update the exact `papers` row so `primary_file_id`, storage path, filename, size, and SHA-256 point to the merged PDF.
5. Add `metadata.translationAttachment.originalAttachment` with the original bucket, object path, filename, size, and SHA-256.
6. Add the translation date, source language, workflow/model, merged hash, and target-system provenance.

Never delete, move, or overwrite the original storage object. The original remains recoverable at its prior path and is also present as the second part of the merged PDF.

## Verification Gate

After apply, independently read back and verify:

- exactly one active `paper_files` row exists;
- that row and the `papers` primary-file pointer both resolve to the merged object and merged SHA-256;
- the original object named in provenance metadata still downloads and matches the original SHA-256;
- the merged PDF is the expected size/hash and is primary;
- the translation provenance note and metadata are present;
- assignment, screening votes, resolver decisions, promotion state, and unrelated papers are unchanged;
- the audit records each completed or retried step without hiding a partial attempt.

For a full translation-based extraction follow-up, also run the Tabs 1-10 and population integrity gate in `skills/gbi-live-extraction/references/review-gate.md`.

## Rollback Facts

The pre-apply snapshot must be sufficient to restore the existing `paper_files` row and `papers` pointer to the original bucket, path, filename, size, and SHA-256. Rollback never requires deleting the merged storage object. Any deletion remains a separately approved destructive action.
