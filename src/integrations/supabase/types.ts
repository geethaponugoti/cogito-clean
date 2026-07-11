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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          analysis_json: Json | null
          correction_attempts: number
          cost_usd: number
          created_at: string
          dataset_id: string
          duration_ms: number
          error_message: string | null
          id: string
          input_tokens: number
          output_tokens: number
          owner_token: string | null
          status: string
          tool_calls_json: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          analysis_json?: Json | null
          correction_attempts?: number
          cost_usd?: number
          created_at?: string
          dataset_id: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          owner_token?: string | null
          status?: string
          tool_calls_json?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          analysis_json?: Json | null
          correction_attempts?: number
          cost_usd?: number
          created_at?: string
          dataset_id?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          owner_token?: string | null
          status?: string
          tool_calls_json?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_embeddings: {
        Row: {
          analysis_id: string
          content: string
          created_at: string
          dataset_id: string
          embedding: string
          id: string
          owner_token: string | null
        }
        Insert: {
          analysis_id: string
          content: string
          created_at?: string
          dataset_id: string
          embedding: string
          id?: string
          owner_token?: string | null
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string
          dataset_id?: string
          embedding?: string
          id?: string
          owner_token?: string | null
        }
        Relationships: []
      }
      analysis_tool_calls: {
        Row: {
          analysis_id: string
          called_at: string
          duration_ms: number
          id: string
          tool_input_json: Json
          tool_name: string
          tool_result_json: Json
        }
        Insert: {
          analysis_id: string
          called_at?: string
          duration_ms?: number
          id?: string
          tool_input_json?: Json
          tool_name: string
          tool_result_json?: Json
        }
        Update: {
          analysis_id?: string
          called_at?: string
          duration_ms?: number
          id?: string
          tool_input_json?: Json
          tool_name?: string
          tool_result_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "analysis_tool_calls_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          tool_calls_json: Json | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          tool_calls_json?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          tool_calls_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          dataset_id: string
          id: string
          owner_token: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dataset_id: string
          id?: string
          owner_token?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dataset_id?: string
          id?: string
          owner_token?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          analysis_id: string
          content: string
          created_at: string
          id: string
          insight_ref: string
          owner_token: string | null
          user_id: string | null
        }
        Insert: {
          analysis_id: string
          content: string
          created_at?: string
          id?: string
          insight_ref: string
          owner_token?: string | null
          user_id?: string | null
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string
          id?: string
          insight_ref?: string
          owner_token?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_embeddings: {
        Row: {
          content: string
          created_at: string
          dataset_id: string
          embedding: string
          id: string
          owner_token: string | null
        }
        Insert: {
          content: string
          created_at?: string
          dataset_id: string
          embedding: string
          id?: string
          owner_token?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          dataset_id?: string
          embedding?: string
          id?: string
          owner_token?: string | null
        }
        Relationships: []
      }
      datasets: {
        Row: {
          analysis_count: number
          col_count: number
          column_stats_json: Json
          created_at: string
          file_path: string | null
          file_size: number
          filename: string
          id: string
          last_analyzed_at: string | null
          owner_token: string | null
          row_count: number
          sample_rows_json: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          analysis_count?: number
          col_count?: number
          column_stats_json?: Json
          created_at?: string
          file_path?: string | null
          file_size?: number
          filename: string
          id?: string
          last_analyzed_at?: string | null
          owner_token?: string | null
          row_count?: number
          sample_rows_json?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          analysis_count?: number
          col_count?: number
          column_stats_json?: Json
          created_at?: string
          file_path?: string | null
          file_size?: number
          filename?: string
          id?: string
          last_analyzed_at?: string | null
          owner_token?: string | null
          row_count?: number
          sample_rows_json?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shared_analyses: {
        Row: {
          analysis_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_public: boolean
          owner_token: string | null
          permissions_json: Json
          share_token: string
          view_count: number
        }
        Insert: {
          analysis_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          owner_token?: string | null
          permissions_json?: Json
          share_token: string
          view_count?: number
        }
        Update: {
          analysis_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          owner_token?: string | null
          permissions_json?: Json
          share_token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shared_analyses_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          action_type: string
          analysis_id: string | null
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          action_type: string
          analysis_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          action_type?: string
          analysis_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_owner_token: { Args: never; Returns: string }
      get_shared_analysis: {
        Args: { p_share_token: string }
        Returns: {
          analysis_id: string
          analysis_json: Json
          col_count: number
          created_at: string
          dataset_id: string
          filename: string
          permissions_json: Json
          row_count: number
        }[]
      }
      match_similar_analyses: {
        Args: {
          exclude_analysis_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          analysis_id: string
          content: string
          created_at: string
          dataset_id: string
          similarity: number
        }[]
      }
      match_similar_datasets: {
        Args: {
          exclude_dataset_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          col_count: number
          created_at: string
          dataset_id: string
          filename: string
          row_count: number
          similarity: number
        }[]
      }
      record_share_view: { Args: { p_share_token: string }; Returns: undefined }
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
