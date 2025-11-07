export type UserRole = 'admin' | 'extractor' | 'observer';

export type PaperStatus = 'uploaded' | 'processing' | 'extracted' | 'flagged' | 'qa_review' | 'archived' | 'mental_health' | 'uefa' | 'american_data';

export type AssignmentStatus = 'claimed' | 'in_progress' | 'completed' | 'released' | 'returned';

export type ExtractionFieldStatus = 'reported' | 'not_reported' | 'uncertain';

export type ExtractionMetric = 'prevalence' | 'incidence' | 'burden' | 'severityMeanDays' | 'severityTotalDays';

export type ExportKind = 'csv' | 'json';

export type ExportStatus = 'pending' | 'ready' | 'failed';

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

// Profile ID of user who made the update, or null for system/AI
export type ExtractionUpdatedBy = string | null;

export interface Database {
  public: {
    Tables: {
      export_jobs: {
        Row: {
          id: string;
          kind: ExportKind;
          paper_ids: string[];
          status: ExportStatus;
          created_at: string;
          checksum_sha256: string | null;
          download_path?: string | null;
        };
        Insert: {
          id?: string;
          kind: ExportKind;
          paper_ids: string[];
          status?: ExportStatus;
          created_at?: string;
          checksum_sha256?: string | null;
        };
        Update: {
          id?: string;
          kind?: ExportKind;
          paper_ids?: string[];
          status?: ExportStatus;
          created_at?: string;
          checksum_sha256?: string | null;
        };
        Relationships: [];
      };
      extraction_fields: {
        Row: {
          id: string;
          extraction_id: string;
          field_id: string;
          value: string | null;
          confidence: number | null;
          source_quote: string | null;
          page_hint: string | null;
          metric: ExtractionMetric | null;
          status: ExtractionFieldStatus;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          extraction_id: string;
          field_id: string;
          value?: string | null;
          confidence?: number | null;
          source_quote?: string | null;
          page_hint?: string | null;
          metric?: ExtractionMetric | null;
          status?: ExtractionFieldStatus;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          extraction_id?: string;
          field_id?: string;
          value?: string | null;
          confidence?: number | null;
          source_quote?: string | null;
          page_hint?: string | null;
          metric?: ExtractionMetric | null;
          status?: ExtractionFieldStatus;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'extraction_fields_extraction_id_fkey';
            columns: ['extraction_id'];
            isOneToOne: false;
            referencedRelation: 'extractions';
            referencedColumns: ['id'];
          },
        ];
      };
      extractions: {
        Row: {
          id: string;
          paper_id: string;
          tab: ExtractionTab;
          model: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          tab: ExtractionTab;
          model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          tab?: ExtractionTab;
          model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'extractions_paper_id_fkey';
            columns: ['paper_id'];
            isOneToOne: false;
            referencedRelation: 'papers';
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
          flag_reason: string | null;
          assigned_to: string | null;
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
          flag_reason?: string | null;
          assigned_to?: string | null;
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
          flag_reason?: string | null;
          assigned_to?: string | null;
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
            foreignKeyName: 'papers_assigned_to_fkey';
            columns: ['assigned_to'];
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
      paper_files: {
        Row: {
          id: string;
          paper_id: string;
          name: string;
          size: number;
          mime_type: string;
          uploaded_at: string;
          storage_bucket: string | null;
          storage_object_path: string | null;
          public_url: string | null;
          data_base64: string | null;
        };
        Insert: {
          id?: string;
          paper_id: string;
          name: string;
          size: number;
          mime_type: string;
          uploaded_at?: string;
          storage_bucket?: string | null;
          storage_object_path?: string | null;
          public_url?: string | null;
          data_base64?: string | null;
        };
        Update: {
          id?: string;
          paper_id?: string;
          name?: string;
          size?: number;
          mime_type?: string;
          uploaded_at?: string;
          storage_bucket?: string | null;
          storage_object_path?: string | null;
          public_url?: string | null;
          data_base64?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'paper_files_paper_id_fkey';
            columns: ['paper_id'];
            isOneToOne: false;
            referencedRelation: 'papers';
            referencedColumns: ['id'];
          },
        ];
      };
      paper_notes: {
        Row: {
          id: string;
          paper_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'paper_notes_paper_id_fkey';
            columns: ['paper_id'];
            isOneToOne: false;
            referencedRelation: 'papers';
            referencedColumns: ['id'];
          },
        ];
      };
      population_groups: {
        Row: {
          id: string;
          paper_id: string;
          tab: ExtractionTab;
          label: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          tab?: ExtractionTab;
          label: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          tab?: ExtractionTab;
          label?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'population_groups_paper_id_fkey';
            columns: ['paper_id'];
            isOneToOne: false;
            referencedRelation: 'papers';
            referencedColumns: ['id'];
          },
        ];
      };
      population_values: {
        Row: {
          id: string;
          population_group_id: string;
          paper_id: string;
          field_id: string;
          value: string | null;
          metric: ExtractionMetric | null;
          unit: string | null;
          source_field_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          population_group_id: string;
          paper_id: string;
          field_id: string;
          value?: string | null;
          metric?: ExtractionMetric | null;
          unit?: string | null;
          source_field_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          population_group_id?: string;
          paper_id?: string;
          field_id?: string;
          value?: string | null;
          metric?: ExtractionMetric | null;
          unit?: string | null;
          source_field_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'population_values_group_id_fkey';
            columns: ['population_group_id'];
            isOneToOne: false;
            referencedRelation: 'population_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'population_values_paper_id_fkey';
            columns: ['paper_id'];
            isOneToOne: false;
            referencedRelation: 'papers';
            referencedColumns: ['id'];
          },
        ];
      };
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
      extraction_tab: ExtractionTab;
      extraction_updated_by: ExtractionUpdatedBy;
    };
  };
}
