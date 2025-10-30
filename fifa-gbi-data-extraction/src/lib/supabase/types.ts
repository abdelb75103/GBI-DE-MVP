export type UserRole = 'admin' | 'extractor' | 'observer';

export type PaperStatus = 'uploaded' | 'processing' | 'extracted' | 'flagged' | 'qa_review' | 'archived';

export type AssignmentStatus = 'claimed' | 'in_progress' | 'completed' | 'released' | 'returned';

export type ExtractionFieldStatus = 'reported' | 'not_reported' | 'uncertain';

export type ExtractionMetric = 'prevalence' | 'incidence' | 'burden' | 'severityMeanDays' | 'severityTotalDays';

export type ExportKind = 'csv' | 'json';

export type ExportStatus = 'pending' | 'ready' | 'failed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          preferred_email: string | null;
          avatar_url: string | null;
          default_gemini_model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: UserRole;
          preferred_email?: string | null;
          avatar_url?: string | null;
          default_gemini_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          preferred_email?: string | null;
          avatar_url?: string | null;
          default_gemini_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      papers: {
        Row: {
          id: string;
          assigned_study_id: string;
          title: string;
          lead_author: string | null;
          journal: string | null;
          year: string | null;
          doi: string | null;
          status: PaperStatus;
          storage_bucket: string;
          storage_object_path: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
          updated_at: string;
          metadata: Record<string, unknown>;
          primary_file_id: string | null;
        };
        Insert: {
          id?: string;
          assigned_study_id?: string;
          title: string;
          lead_author?: string | null;
          journal?: string | null;
          year?: string | null;
          doi?: string | null;
          status?: PaperStatus;
          storage_bucket?: string;
          storage_object_path?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          updated_at?: string;
          metadata?: Record<string, unknown>;
          primary_file_id?: string | null;
        };
        Update: {
          id?: string;
          assigned_study_id?: string;
          title?: string;
          lead_author?: string | null;
          journal?: string | null;
          year?: string | null;
          doi?: string | null;
          status?: PaperStatus;
          storage_bucket?: string;
          storage_object_path?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          updated_at?: string;
          metadata?: Record<string, unknown>;
          primary_file_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'papers_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'papers_primary_file_fk';
            columns: ['primary_file_id'];
            isOneToOne: true;
            referencedRelation: 'paper_files';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: never;
    Functions: {
      current_role: {
        Args: Record<string, never>;
        Returns: UserRole | null;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_extractor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_observer: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      paper_status: PaperStatus;
      assignment_status: AssignmentStatus;
      extraction_field_status: ExtractionFieldStatus;
      extraction_metric: ExtractionMetric;
      export_kind: ExportKind;
      export_status: ExportStatus;
    };
  };
}
