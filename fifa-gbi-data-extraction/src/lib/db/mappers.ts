import type {
  ExtractionFieldResult,
  ExtractionResult,
  ExportJob,
  Paper,
  PaperNote,
  PopulationGroup,
  PopulationValue,
  ScreeningRecord,
  StoredFile,
} from '@/lib/types';
import type { ExtractionTab } from '@/lib/types';
import type {
  ExtractionFieldRow,
  ExtractionRow,
  ExportJobRow,
  FileRow,
  NoteRow,
  PaperRow,
  PopulationGroupRow,
  PopulationValueRow,
  ScreeningRecordRow,
} from '@/lib/db/types';
import { normalizeRowMetadata, parseActiveSession } from '@/lib/db/shared';

export const mapPaperRow = (row: PaperRow, noteCount = 0): Paper => {
  const metadata = normalizeRowMetadata(row.metadata);
  const activeSession = parseActiveSession(metadata, row.id);

  return {
    id: row.id,
    assignedStudyId: row.assigned_study_id ?? '',
    title: row.title,
    extractedTitle: row.extracted_title ?? null,
    normalizedDoi: row.normalized_doi ?? null,
    duplicateKeyV2: row.duplicate_key_v2 ?? null,
    titleFingerprint: row.title_fingerprint ?? null,
    dedupeReviewStatus: row.dedupe_review_status ?? undefined,
    primaryFileSha256: row.primary_file_sha256 ?? null,
    originalFileName: row.original_file_name ?? null,
    status: row.status,
    leadAuthor: row.lead_author,
    journal: row.journal,
    year: row.year,
    doi: row.doi,
    createdAt: row.uploaded_at,
    updatedAt: row.updated_at,
    storageBucket: row.storage_bucket ?? null,
    storageObjectPath: row.storage_object_path ?? null,
    primaryFileId: row.primary_file_id ?? null,
    flagReason: row.flag_reason ?? null,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    noteCount,
    assignedTo: row.assigned_to ?? null,
    activeSession,
  };
};

export const mapFileRow = (row: FileRow): StoredFile => ({
  id: row.id,
  paperId: row.paper_id,
  name: row.name,
  originalFileName: row.original_file_name ?? null,
  size: row.size,
  mimeType: row.mime_type,
  uploadedAt: row.uploaded_at,
  storageBucket: row.storage_bucket ?? null,
  storageObjectPath: row.storage_object_path ?? null,
  publicUrl: row.public_url ?? null,
  dataBase64: row.data_base64 ?? null,
  fileSha256: row.file_sha256 ?? null,
});

export const mapNoteRow = (row: NoteRow): PaperNote => ({
  id: row.id,
  paperId: row.paper_id,
  body: row.body,
  createdAt: row.created_at,
});

export const mapExportRow = (row: ExportJobRow): ExportJob => ({
  id: row.id,
  kind: row.kind,
  paperIds: row.paper_ids ?? [],
  status: row.status,
  createdAt: row.created_at,
  downloadUrl: row.download_path ?? `/api/exports/${row.id}/download`,
  checksumSha256: row.checksum_sha256 ?? null,
});

export const mapPopulationGroupRow = (row: PopulationGroupRow): PopulationGroup => ({
  id: row.id,
  paperId: row.paper_id,
  tab: row.tab as ExtractionTab,
  label: row.label,
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapPopulationValueRow = (row: PopulationValueRow): PopulationValue => ({
  id: row.id,
  populationGroupId: row.population_group_id,
  paperId: row.paper_id,
  fieldId: row.field_id,
  value: row.value ?? null,
  metric: row.metric ?? null,
  unit: row.unit ?? null,
  sourceFieldId: row.source_field_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapExtractionFieldRow = (row: ExtractionFieldRow): ExtractionFieldResult => ({
  fieldId: row.field_id,
  value: row.value ?? null,
  confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null,
  sourceQuote: row.source_quote ?? null,
  pageHint: row.page_hint ?? null,
  metric: row.metric ?? undefined,
  status: row.status,
  updatedAt: row.updated_at,
  updatedBy: (row as { updated_by?: string | null }).updated_by ?? null,
});

export const mapExtractionRow = (
  row: ExtractionRow & { extraction_fields?: ExtractionFieldRow[] | null },
): ExtractionResult => ({
  id: row.id,
  paperId: row.paper_id,
  tab: row.tab,
  model: row.model,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  fields: (row.extraction_fields ?? []).map(mapExtractionFieldRow),
  notes: null,
});

export const mapScreeningRecordRow = (
  row: ScreeningRecordRow,
  profileNames: Map<string, string> = new Map(),
): ScreeningRecord => ({
  id: row.id,
  stage: row.stage,
  assignedStudyId: row.assigned_study_id,
  title: row.title,
  abstract: row.abstract ?? null,
  leadAuthor: row.lead_author ?? null,
  journal: row.journal ?? null,
  year: row.year ?? null,
  doi: row.doi ?? null,
  normalizedDoi: row.normalized_doi ?? null,
  sourceLabel: row.source_label ?? null,
  sourceRecordId: row.source_record_id ?? null,
  storageBucket: row.storage_bucket ?? null,
  storageObjectPath: row.storage_object_path ?? null,
  dataBase64: row.data_base64 ?? null,
  fileName: row.file_name ?? null,
  originalFileName: row.original_file_name ?? null,
  mimeType: row.mime_type ?? null,
  size: row.size === null || row.size === undefined ? null : Number(row.size),
  fileSha256: row.file_sha256 ?? null,
  aiStatus: row.ai_status,
  aiSuggestedDecision: row.ai_suggested_decision ?? null,
  aiReason: row.ai_reason ?? null,
  aiEvidenceQuote: row.ai_evidence_quote ?? null,
  aiSourceLocation: row.ai_source_location ?? null,
  aiConfidence: row.ai_confidence === null || row.ai_confidence === undefined ? null : Number(row.ai_confidence),
  aiModel: row.ai_model ?? null,
  aiCriteriaVersion: row.ai_criteria_version ?? null,
  aiRawResponse: row.ai_raw_response,
  aiError: row.ai_error ?? null,
  aiReviewedAt: row.ai_reviewed_at ?? null,
  manualDecision: row.manual_decision ?? null,
  manualReason: row.manual_reason ?? null,
  manualDecidedBy: row.manual_decided_by ?? null,
  manualDecidedByName: row.manual_decided_by ? profileNames.get(row.manual_decided_by) : undefined,
  manualDecidedAt: row.manual_decided_at ?? null,
  promotedPaperId: row.promoted_paper_id ?? null,
  promotedBy: row.promoted_by ?? null,
  promotedByName: row.promoted_by ? profileNames.get(row.promoted_by) : undefined,
  promotedAt: row.promoted_at ?? null,
  createdBy: row.created_by ?? null,
  createdByName: row.created_by ? profileNames.get(row.created_by) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  metadata: normalizeRowMetadata(row.metadata),
  notes: row.notes ?? null,
});
