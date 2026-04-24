import type { Database } from '@/lib/supabase/types';

export type AiReviewDecisionRow = Database['public']['Tables']['ai_review_decisions']['Row'];
export type AiReviewDecisionInsert = Database['public']['Tables']['ai_review_decisions']['Insert'];

export type PaperRow = Database['public']['Tables']['papers']['Row'];
export type PaperInsert = Database['public']['Tables']['papers']['Insert'];
export type PaperUpdate = Database['public']['Tables']['papers']['Update'];

export type FileRow = Database['public']['Tables']['paper_files']['Row'];
export type FileInsert = Database['public']['Tables']['paper_files']['Insert'];

export type NoteRow = Database['public']['Tables']['paper_notes']['Row'];
export type NoteInsert = Database['public']['Tables']['paper_notes']['Insert'];

export type ExtractionRow = Database['public']['Tables']['extractions']['Row'];
export type ExtractionInsert = Database['public']['Tables']['extractions']['Insert'];
export type ExtractionFieldRow = Database['public']['Tables']['extraction_fields']['Row'];
export type ExtractionFieldInsert = Database['public']['Tables']['extraction_fields']['Insert'];

export type ExportJobRow = Database['public']['Tables']['export_jobs']['Row'];
export type PaperDuplicateRow = Database['public']['Tables']['paper_duplicates']['Row'];
export type UploadQueueRow = Database['public']['Tables']['paper_upload_queue']['Row'];
export type UploadQueueInsert = Database['public']['Tables']['paper_upload_queue']['Insert'];
export type ScreeningRecordRow = Database['public']['Tables']['screening_records']['Row'];
export type ScreeningRecordInsert = Database['public']['Tables']['screening_records']['Insert'];
export type ScreeningRecordUpdate = Database['public']['Tables']['screening_records']['Update'];

export type PopulationGroupRow = Database['public']['Tables']['population_groups']['Row'];
export type PopulationValueRow = Database['public']['Tables']['population_values']['Row'];
