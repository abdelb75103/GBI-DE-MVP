export type PaperStatus = 'uploaded' | 'processing' | 'extracted' | 'flagged';

export interface StoredFile {
  id: string;
  paperId: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  dataBase64?: string;
}

export type ExtractionTab =
  | 'studyDetails'
  | 'participantCharacteristics'
  | 'definitions'
  | 'exposure'
  | 'injuryOutcome'
  | 'illnessOutcome'
  | 'mentalHealthOutcomes'
  | 'injuryTissueType'
  | 'injuryLocation'
  | 'illnessRegion'
  | 'illnessEtiology'
  | 'mentalHealthSymptoms';

export type ExtractionFieldMetric =
  | 'prevalence'
  | 'incidence'
  | 'burden'
  | 'severityMeanDays'
  | 'severityTotalDays';

export type ExtractionFieldStatus = 'reported' | 'not_reported' | 'uncertain';

export interface ExtractionFieldResult {
  fieldId: string;
  value: string | null;
  confidence: number | null;
  sourceQuote?: string;
  pageHint?: string;
  metric?: ExtractionFieldMetric;
  status: ExtractionFieldStatus;
  updatedAt: string;
  updatedBy: 'ai' | 'human';
}

export interface ExtractionResult {
  id: string;
  paperId: string;
  tab: ExtractionTab;
  model: string;
  fields: ExtractionFieldResult[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface Flag {
  id: string;
  paperId: string;
  reason: string;
  createdAt: string;
}

export interface Note {
  id: string;
  paperId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Paper {
  id: string;
  title: string;
  status: PaperStatus;
  leadAuthor?: string;
  year?: string;
  journal?: string;
  doi?: string;
  createdAt: string;
  updatedAt: string;
  fileId: string;
  flagId?: string;
  noteIds: string[];
}

export interface ExportJob {
  id: string;
  kind: 'csv' | 'json';
  paperIds: string[];
  status: 'pending' | 'ready';
  createdAt: string;
  downloadUrl?: string;
  checksumSha256?: string;
}

export interface MockDatabase {
  papers: Paper[];
  files: StoredFile[];
  flags: Flag[];
  notes: Note[];
  exports: ExportJob[];
  extractions: ExtractionResult[];
}
