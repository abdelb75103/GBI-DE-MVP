import type { ExtractionMetric, UploadQueueStatus } from '@/lib/supabase/types';

export type PaperStatus =
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'flagged'
  | 'qa_review'
  | 'archived'
  | 'mental_health'
  | 'uefa'
  | 'no_exposure'
  | 'fifa_data'
  | 'aspetar_asprev'
  | 'american_data'
  | 'systematic_review'
  | 'referee'
  | 'retrospective_substudy_analysis';

export type ExtractionTab =
  | 'studyDetails'
  | 'participantCharacteristics'
  | 'definitions'
  | 'exposure'
  | 'injuryOutcome'
  | 'illnessOutcome'
  | 'injuryTissueType'
  | 'injuryLocation'
  | 'illnessRegion'
  | 'illnessEtiology';

// Use the database-defined type for consistency
export type ExtractionFieldMetric = ExtractionMetric;

export type ExtractionFieldStatus = 'reported' | 'not_reported' | 'uncertain';

export type ExtractionUpdatedBy = string | null;

export type DedupeReviewStatus = 'clean' | 'duplicate' | 'possible' | 'needs_review';

export type ScreeningStage = 'title_abstract' | 'full_text';
export type ScreeningAiStatus = 'not_run' | 'running' | 'completed' | 'failed';
export type ScreeningDecision = 'include' | 'exclude';

export interface PaperSession {
  paperId: string;
  profileId: string;
  fullName: string;
  startedAt: string;
  lastHeartbeatAt: string;
}

export interface Paper {
  id: string;
  assignedStudyId: string;
  title: string;
  status: PaperStatus;
  leadAuthor: string | null;
  journal: string | null;
  year: string | null;
  doi: string | null;
  extractedTitle?: string | null;
  normalizedDoi?: string | null;
  duplicateKeyV2?: string | null;
  titleFingerprint?: string | null;
  dedupeReviewStatus?: DedupeReviewStatus;
  primaryFileSha256?: string | null;
  originalFileName?: string | null;
  createdAt: string;
  updatedAt: string;
  storageBucket: string | null;
  storageObjectPath: string | null;
  primaryFileId: string | null;
  flagReason: string | null;
  metadata?: Record<string, unknown>;
  noteCount: number;
  assignedTo: string | null;
  assigneeName?: string;
  downloadUrl?: string | null;
  activeSession: PaperSession | null;
}

export interface StoredFile {
  id: string;
  paperId: string;
  name: string;
  originalFileName?: string | null;
  size: number;
  mimeType: string;
  uploadedAt: string;
  storageBucket: string | null;
  storageObjectPath: string | null;
  publicUrl: string | null;
  dataBase64?: string | null;
  fileSha256?: string | null;
}

export interface PaperNote {
  id: string;
  paperId: string;
  body: string;
  createdAt: string;
}

export interface ExtractionFieldResult {
  fieldId: string;
  value: string | null;
  confidence: number | null;
  sourceQuote?: string | null;
  pageHint?: string | null;
  metric?: ExtractionFieldMetric | null;
  status: ExtractionFieldStatus;
  updatedAt: string;
  updatedBy: ExtractionUpdatedBy;
}

export interface ExtractionResult {
  id: string;
  paperId: string;
  tab: ExtractionTab;
  model: string;
  fields: ExtractionFieldResult[];
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
}

export interface PopulationGroup {
  id: string;
  paperId: string;
  tab: ExtractionTab;
  label: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PopulationValue {
  id: string;
  populationGroupId: string;
  paperId: string;
  fieldId: string;
  value: string | null;
  metric: ExtractionFieldMetric | null;
  unit: string | null;
  sourceFieldId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportJob {
  id: string;
  kind: 'csv' | 'json';
  paperIds: string[];
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
  downloadUrl?: string | null;
  checksumSha256?: string | null;
}

export interface PaperDuplicate {
  id: string;
  paperIdA: string;
  paperIdB: string;
  reason: string;
  score: number | null;
  level: 'duplicate' | 'possible';
  status: 'unreviewed' | 'confirmed_duplicate' | 'not_duplicate' | 'dismissed';
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
}

export interface UploadQueueItem {
  id: string;
  status: UploadQueueStatus;
  title: string;
  extractedTitle: string | null;
  leadAuthor: string | null;
  year: string | null;
  journal: string | null;
  doi: string | null;
  normalizedDoi: string | null;
  duplicateKeyV2: string | null;
  titleFingerprint: string | null;
  metadata: Record<string, unknown>;
  fileName: string;
  originalFileName: string | null;
  mimeType: string;
  size: number;
  fileSha256: string | null;
  storageBucket: string | null;
  storageObjectPath: string | null;
  dataBase64: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName?: string;
  approvedAt: string | null;
  approvedBy: string | null;
  approvedByName?: string;
  paperId: string | null;
}

export interface ScreeningRecord {
  id: string;
  stage: ScreeningStage;
  assignedStudyId: string;
  title: string;
  abstract: string | null;
  leadAuthor: string | null;
  journal: string | null;
  year: string | null;
  doi: string | null;
  normalizedDoi: string | null;
  sourceLabel: string | null;
  sourceRecordId: string | null;
  storageBucket: string | null;
  storageObjectPath: string | null;
  dataBase64?: string | null;
  fileName: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  size: number | null;
  fileSha256: string | null;
  aiStatus: ScreeningAiStatus;
  aiSuggestedDecision: ScreeningDecision | null;
  aiReason: string | null;
  aiEvidenceQuote: string | null;
  aiSourceLocation: string | null;
  aiConfidence: number | null;
  aiModel: string | null;
  aiCriteriaVersion: string | null;
  aiRawResponse?: unknown;
  aiError: string | null;
  aiReviewedAt: string | null;
  manualDecision: ScreeningDecision | null;
  manualReason: string | null;
  manualDecidedBy: string | null;
  manualDecidedByName?: string;
  manualDecidedAt: string | null;
  promotedPaperId: string | null;
  promotedBy: string | null;
  promotedByName?: string;
  promotedAt: string | null;
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  notes: string | null;
}
