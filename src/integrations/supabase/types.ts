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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          address: string | null
          cif: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          postal_code: string | null
          settings: Json | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cif?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          postal_code?: string | null
          settings?: Json | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cif?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          postal_code?: string | null
          settings?: Json | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      corrected_events: {
        Row: {
          company_id: string | null
          correction_request_id: string
          created_at: string
          employee_id: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          local_timestamp: string
          timestamp: string
          timezone: string
        }
        Insert: {
          company_id?: string | null
          correction_request_id: string
          created_at?: string
          employee_id: string
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          local_timestamp: string
          timestamp: string
          timezone?: string
        }
        Update: {
          company_id?: string | null
          correction_request_id?: string
          created_at?: string
          employee_id?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          local_timestamp?: string
          timestamp?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrected_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrected_events_correction_request_id_fkey"
            columns: ["correction_request_id"]
            isOneToOne: false
            referencedRelation: "correction_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrected_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_requests: {
        Row: {
          company_id: string | null
          created_at: string
          employee_id: string
          id: string
          original_event_id: string | null
          reason: string
          requested_event_type: Database["public"]["Enums"]["event_type"] | null
          requested_timestamp: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["correction_status"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          original_event_id?: string | null
          reason: string
          requested_event_type?:
            | Database["public"]["Enums"]["event_type"]
            | null
          requested_timestamp?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          original_event_id?: string | null
          reason?: string
          requested_event_type?:
            | Database["public"]["Enums"]["event_type"]
            | null
          requested_timestamp?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_original_event_id_fkey"
            columns: ["original_event_id"]
            isOneToOne: false
            referencedRelation: "time_events"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_roots: {
        Row: {
          company_id: string | null
          created_at: string
          date: string
          event_count: number
          id: string
          root_hash: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date: string
          event_count?: number
          id?: string
          root_hash: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date?: string
          event_count?: number
          id?: string
          root_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_roots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_case_files: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          external_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          external_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          external_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dt_case_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_evidence_groups: {
        Row: {
          case_file_id: string
          created_at: string
          external_id: string
          id: string
          name: string
          updated_at: string
          year_month: string
        }
        Insert: {
          case_file_id: string
          created_at?: string
          external_id: string
          id?: string
          name: string
          updated_at?: string
          year_month: string
        }
        Update: {
          case_file_id?: string
          created_at?: string
          external_id?: string
          id?: string
          name?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "dt_evidence_groups_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "dt_case_files"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_evidences: {
        Row: {
          completed_at: string | null
          created_at: string
          daily_root_id: string | null
          error_message: string | null
          evidence_group_id: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          external_id: string | null
          id: string
          original_pdf_path: string | null
          report_month: string | null
          retry_count: number
          sealed_pdf_path: string | null
          signature_data: Json | null
          status: Database["public"]["Enums"]["evidence_status"]
          tsp_timestamp: string | null
          tsp_token: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          daily_root_id?: string | null
          error_message?: string | null
          evidence_group_id: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          external_id?: string | null
          id?: string
          original_pdf_path?: string | null
          report_month?: string | null
          retry_count?: number
          sealed_pdf_path?: string | null
          signature_data?: Json | null
          status?: Database["public"]["Enums"]["evidence_status"]
          tsp_timestamp?: string | null
          tsp_token?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          daily_root_id?: string | null
          error_message?: string | null
          evidence_group_id?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          external_id?: string | null
          id?: string
          original_pdf_path?: string | null
          report_month?: string | null
          retry_count?: number
          sealed_pdf_path?: string | null
          signature_data?: Json | null
          status?: Database["public"]["Enums"]["evidence_status"]
          tsp_timestamp?: string | null
          tsp_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dt_evidences_daily_root_id_fkey"
            columns: ["daily_root_id"]
            isOneToOne: false
            referencedRelation: "daily_roots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dt_evidences_evidence_group_id_fkey"
            columns: ["evidence_group_id"]
            isOneToOne: false
            referencedRelation: "dt_evidence_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_qr: {
        Row: {
          company_id: string | null
          created_at: string
          employee_id: string
          id: string
          is_active: boolean
          revoked_at: string | null
          token_hash: string
          version: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          token_hash: string
          version?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          token_hash?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_qr_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_qr_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string | null
          created_at: string
          department: string | null
          email: string | null
          employee_code: string
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          pin_failed_attempts: number | null
          pin_hash: string | null
          pin_locked_until: string | null
          pin_salt: string | null
          position: string | null
          status: Database["public"]["Enums"]["employee_status"]
          termination_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_code: string
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          phone?: string | null
          pin_failed_attempts?: number | null
          pin_hash?: string | null
          pin_locked_until?: string | null
          pin_salt?: string | null
          position?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_code?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          pin_failed_attempts?: number | null
          pin_hash?: string | null
          pin_locked_until?: string | null
          pin_salt?: string | null
          position?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      terminals: {
        Row: {
          auth_token_hash: string | null
          company_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          last_seen_at: string | null
          location: string | null
          name: string
          pairing_code: string | null
          pairing_expires_at: string | null
          settings: Json | null
          status: Database["public"]["Enums"]["terminal_status"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth_token_hash?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string | null
          location?: string | null
          name: string
          pairing_code?: string | null
          pairing_expires_at?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["terminal_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth_token_hash?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string | null
          location?: string | null
          name?: string
          pairing_code?: string | null
          pairing_expires_at?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["terminal_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      time_events: {
        Row: {
          company_id: string | null
          created_at: string
          employee_id: string
          event_hash: string | null
          event_source: Database["public"]["Enums"]["event_source"]
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          ip_address: unknown
          local_timestamp: string
          offline_uuid: string | null
          previous_hash: string | null
          qr_version: number | null
          raw_payload: Json | null
          synced_at: string | null
          terminal_id: string | null
          timestamp: string
          timezone: string
          user_agent: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_id: string
          event_hash?: string | null
          event_source: Database["public"]["Enums"]["event_source"]
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          ip_address?: unknown
          local_timestamp: string
          offline_uuid?: string | null
          previous_hash?: string | null
          qr_version?: number | null
          raw_payload?: Json | null
          synced_at?: string | null
          terminal_id?: string | null
          timestamp: string
          timezone?: string
          user_agent?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_id?: string
          event_hash?: string | null
          event_source?: Database["public"]["Enums"]["event_source"]
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          ip_address?: unknown
          local_timestamp?: string
          offline_uuid?: string | null
          previous_hash?: string | null
          qr_version?: number | null
          raw_payload?: Json | null
          synced_at?: string | null
          terminal_id?: string | null
          timestamp?: string
          timezone?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_employee_id: { Args: { _user_id: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "responsible" | "employee"
      correction_status: "pending" | "approved" | "rejected"
      employee_status: "active" | "inactive" | "suspended" | "on_leave"
      event_source: "qr" | "pin" | "manual"
      event_type: "entry" | "exit"
      evidence_status: "pending" | "processing" | "completed" | "failed"
      evidence_type: "daily_timestamp" | "monthly_report"
      terminal_status: "pending" | "active" | "inactive"
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
    Enums: {
      app_role: ["super_admin", "admin", "responsible", "employee"],
      correction_status: ["pending", "approved", "rejected"],
      employee_status: ["active", "inactive", "suspended", "on_leave"],
      event_source: ["qr", "pin", "manual"],
      event_type: ["entry", "exit"],
      evidence_status: ["pending", "processing", "completed", "failed"],
      evidence_type: ["daily_timestamp", "monthly_report"],
      terminal_status: ["pending", "active", "inactive"],
    },
  },
} as const
