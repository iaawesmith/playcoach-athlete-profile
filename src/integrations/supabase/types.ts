export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_enhancements: {
        Row: {
          created_at: string
          description: string
          id: string
          lovable_prompt: string | null
          notes: string | null
          reason: string
          tab: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          lovable_prompt?: string | null
          notes?: string | null
          reason?: string
          tab: string
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lovable_prompt?: string | null
          notes?: string | null
          reason?: string
          tab?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: []
      }
      admin_implementation_docs: {
        Row: {
          content: string
          created_at: string
          display_order: number
          id: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_reference_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          id: string
          synced_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data?: Json
          id?: string
          synced_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          id?: string
          synced_at?: string
        }
        Relationships: []
      }
      admin_reference_links: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      admin_tab_guidance: {
        Row: {
          content: string
          created_at: string
          id: string
          tab_key: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          tab_key: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tab_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      athlete_lab_nodes: {
        Row: {
          badges: Json
          camera_guidelines: string
          clip_duration_max: number
          clip_duration_min: number
          coaching_cues_migration_status: string
          common_errors: Json
          confidence_handling: string
          created_at: string
          det_frequency: number
          det_frequency_defender: number
          det_frequency_multiple: number
          det_frequency_solo: number
          elite_videos: Json
          form_checkpoints: Json
          icon_url: string | null
          id: string
          key_metrics: Json
          knowledge_base: Json
          llm_max_words: number
          llm_prompt_template: string
          llm_system_instructions: string
          llm_tone: string
          min_metrics_threshold: number
          name: string
          node_version: number
          overview: string
          performance_mode: string
          phase_breakdown: Json
          phase_context_mode: string
          position: string | null
          pro_mechanics: string
          reference_calibrations: Json
          reference_fallback_behavior: string
          reference_filming_instructions: string
          reference_object: string
          score_bands: Json
          scoring_renormalize_on_skip: boolean
          scoring_rules: string
          segmentation_method: string
          solution_class: string
          status: string
          tracking_enabled: boolean
          updated_at: string
        }
        Insert: {
          badges?: Json
          camera_guidelines?: string
          clip_duration_max?: number
          clip_duration_min?: number
          coaching_cues_migration_status?: string
          common_errors?: Json
          confidence_handling?: string
          created_at?: string
          det_frequency?: number
          det_frequency_defender?: number
          det_frequency_multiple?: number
          det_frequency_solo?: number
          elite_videos?: Json
          form_checkpoints?: Json
          icon_url?: string | null
          id?: string
          key_metrics?: Json
          knowledge_base?: Json
          llm_max_words?: number
          llm_prompt_template?: string
          llm_system_instructions?: string
          llm_tone?: string
          min_metrics_threshold?: number
          name: string
          node_version?: number
          overview?: string
          performance_mode?: string
          phase_breakdown?: Json
          phase_context_mode?: string
          position?: string | null
          pro_mechanics?: string
          reference_calibrations?: Json
          reference_fallback_behavior?: string
          reference_filming_instructions?: string
          reference_object?: string
          score_bands?: Json
          scoring_renormalize_on_skip?: boolean
          scoring_rules?: string
          segmentation_method?: string
          solution_class?: string
          status?: string
          tracking_enabled?: boolean
          updated_at?: string
        }
        Update: {
          badges?: Json
          camera_guidelines?: string
          clip_duration_max?: number
          clip_duration_min?: number
          coaching_cues_migration_status?: string
          common_errors?: Json
          confidence_handling?: string
          created_at?: string
          det_frequency?: number
          det_frequency_defender?: number
          det_frequency_multiple?: number
          det_frequency_solo?: number
          elite_videos?: Json
          form_checkpoints?: Json
          icon_url?: string | null
          id?: string
          key_metrics?: Json
          knowledge_base?: Json
          llm_max_words?: number
          llm_prompt_template?: string
          llm_system_instructions?: string
          llm_tone?: string
          min_metrics_threshold?: number
          name?: string
          node_version?: number
          overview?: string
          performance_mode?: string
          phase_breakdown?: Json
          phase_context_mode?: string
          position?: string | null
          pro_mechanics?: string
          reference_calibrations?: Json
          reference_fallback_behavior?: string
          reference_filming_instructions?: string
          reference_object?: string
          score_bands?: Json
          scoring_renormalize_on_skip?: boolean
          scoring_rules?: string
          segmentation_method?: string
          solution_class?: string
          status?: string
          tracking_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      athlete_lab_nodes_phase1c_backup: {
        Row: {
          content: string | null
          id: string
          node_id: string
          source_column: string
        }
        Insert: {
          content?: string | null
          id?: string
          node_id: string
          source_column: string
        }
        Update: {
          content?: string | null
          id?: string
          node_id?: string
          source_column?: string
        }
        Relationships: []
      }
      athlete_lab_results: {
        Row: {
          aggregate_score: number | null
          analyzed_at: string
          athlete_id: string | null
          confidence_flags: Json
          created_at: string
          detected_errors: Json
          feedback: string
          id: string
          metric_results: Json
          node_id: string
          node_version: number
          overall_score: number | null
          phase_scores: Json
          result_data: Json
          upload_id: string | null
          video_description: string
        }
        Insert: {
          aggregate_score?: number | null
          analyzed_at?: string
          athlete_id?: string | null
          confidence_flags?: Json
          created_at?: string
          detected_errors?: Json
          feedback?: string
          id?: string
          metric_results?: Json
          node_id: string
          node_version?: number
          overall_score?: number | null
          phase_scores?: Json
          result_data?: Json
          upload_id?: string | null
          video_description?: string
        }
        Update: {
          aggregate_score?: number | null
          analyzed_at?: string
          athlete_id?: string | null
          confidence_flags?: Json
          created_at?: string
          detected_errors?: Json
          feedback?: string
          id?: string
          metric_results?: Json
          node_id?: string
          node_version?: number
          overall_score?: number | null
          phase_scores?: Json
          result_data?: Json
          upload_id?: string | null
          video_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_lab_results_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "athlete_lab_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_lab_results_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "athlete_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_uploads: {
        Row: {
          analysis_context: Json
          athlete_id: string
          camera_angle: string | null
          created_at: string | null
          end_seconds: number | null
          error_message: string | null
          id: string
          node_id: string | null
          node_version: number | null
          progress_message: string | null
          start_seconds: number | null
          status: string | null
          video_url: string | null
        }
        Insert: {
          analysis_context?: Json
          athlete_id: string
          camera_angle?: string | null
          created_at?: string | null
          end_seconds?: number | null
          error_message?: string | null
          id?: string
          node_id?: string | null
          node_version?: number | null
          progress_message?: string | null
          start_seconds?: number | null
          status?: string | null
          video_url?: string | null
        }
        Update: {
          analysis_context?: Json
          athlete_id?: string
          camera_angle?: string | null
          created_at?: string | null
          end_seconds?: number | null
          error_message?: string | null
          id?: string
          node_id?: string | null
          node_version?: number | null
          progress_message?: string | null
          start_seconds?: number | null
          status?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_uploads_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "athlete_lab_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_setup_checklist: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          item_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          item_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
