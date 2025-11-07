import type { ExtractionMetric } from '@/lib/supabase/types';

export type PaperStatus = 'uploaded' | 'processing' | 'extracted' | 'flagged' | 'qa_review' | 'archived' | 'mental_health' | 'uefa' | 'american_data';

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
  activeSession: PaperSession | null;
}

export interface StoredFile {
  id: string;
  paperId: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  storageBucket: string | null;
  storageObjectPath: string | null;
  publicUrl: string | null;
  dataBase64?: string | null;
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
