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
      absence_approvals: {
        Row: {
          action: string
          approver_id: string
          created_at: string
          id: string
          notes: string | null
          request_id: string
          step: number | null
        }
        Insert: {
          action: string
          approver_id: string
          created_at?: string
          id?: string
          notes?: string | null
          request_id: string
          step?: number | null
        }
        Update: {
          action?: string
          approver_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          request_id?: string
          step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "absence_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_calendar_blocks: {
        Row: {
          block_date: string
          block_reason: string
          center_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          min_staff_required: number | null
          updated_at: string
        }
        Insert: {
          block_date: string
          block_reason: string
          center_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          min_staff_required?: number | null
          updated_at?: string
        }
        Update: {
          block_date?: string
          block_reason?: string
          center_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          min_staff_required?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_calendar_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_requests: {
        Row: {
          absence_type_id: string
          center_id: string | null
          company_id: string
          coverage_check: Json | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string
          end_half_day: boolean | null
          extra_days_applied: number
          id: string
          justification_files: Json
          justification_meta: Json | null
          justification_path: string | null
          justification_required: boolean
          origin: string | null
          reason: string | null
          requested_at: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          start_date: string
          start_half_day: boolean | null
          status: string
          total_days: number
          total_hours: number | null
          travel_km: number | null
          tz: string | null
          updated_at: string
        }
        Insert: {
          absence_type_id: string
          center_id?: string | null
          company_id: string
          coverage_check?: Json | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date: string
          end_half_day?: boolean | null
          extra_days_applied?: number
          id?: string
          justification_files?: Json
          justification_meta?: Json | null
          justification_path?: string | null
          justification_required?: boolean
          origin?: string | null
          reason?: string | null
          requested_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          start_date: string
          start_half_day?: boolean | null
          status?: string
          total_days: number
          total_hours?: number | null
          travel_km?: number | null
          tz?: string | null
          updated_at?: string
        }
        Update: {
          absence_type_id?: string
          center_id?: string | null
          company_id?: string
          coverage_check?: Json | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string
          end_half_day?: boolean | null
          extra_days_applied?: number
          id?: string
          justification_files?: Json
          justification_meta?: Json | null
          justification_path?: string | null
          justification_required?: boolean
          origin?: string | null
          reason?: string | null
          requested_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          start_date?: string
          start_half_day?: boolean | null
          status?: string
          total_days?: number
          total_hours?: number | null
          travel_km?: number | null
          tz?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_requests_absence_type_id_fkey"
            columns: ["absence_type_id"]
            isOneToOne: false
            referencedRelation: "absence_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_types: {
        Row: {
          absence_category: string
          advance_notice_days: number | null
          alt_mode: string | null
          alt_mode_description: string | null
          approval_flow: string | null
          blocks_clocking: boolean | null
          cap_per_year_unit: string | null
          cap_per_year_value: number | null
          category: string
          code: string
          color: string | null
          company_id: string
          compute_on: string
          convenio_reference: string | null
          counts_as_work: boolean | null
          created_at: string
          description: string | null
          duration_is_range: boolean | null
          duration_unit: string | null
          duration_value: number | null
          effective_from: string | null
          effective_to: string | null
          extra_travel_days: number | null
          half_day_allowed: boolean | null
          id: string
          incompatible_with: Json | null
          is_active: boolean
          is_paid: boolean
          justification_types: Json | null
          legal_origin: string | null
          max_days_per_year: number | null
          min_block_days: number | null
          name: string
          notes: string | null
          preaviso_hours: number | null
          requires_approval: boolean
          requires_justification: boolean
          sla_hours: number | null
          travel_threshold_km: number | null
          updated_at: string
        }
        Insert: {
          absence_category?: string
          advance_notice_days?: number | null
          alt_mode?: string | null
          alt_mode_description?: string | null
          approval_flow?: string | null
          blocks_clocking?: boolean | null
          cap_per_year_unit?: string | null
          cap_per_year_value?: number | null
          category?: string
          code: string
          color?: string | null
          company_id: string
          compute_on?: string
          convenio_reference?: string | null
          counts_as_work?: boolean | null
          created_at?: string
          description?: string | null
          duration_is_range?: boolean | null
          duration_unit?: string | null
          duration_value?: number | null
          effective_from?: string | null
          effective_to?: string | null
          extra_travel_days?: number | null
          half_day_allowed?: boolean | null
          id?: string
          incompatible_with?: Json | null
          is_active?: boolean
          is_paid?: boolean
          justification_types?: Json | null
          legal_origin?: string | null
          max_days_per_year?: number | null
          min_block_days?: number | null
          name: string
          notes?: string | null
          preaviso_hours?: number | null
          requires_approval?: boolean
          requires_justification?: boolean
          sla_hours?: number | null
          travel_threshold_km?: number | null
          updated_at?: string
        }
        Update: {
          absence_category?: string
          advance_notice_days?: number | null
          alt_mode?: string | null
          alt_mode_description?: string | null
          approval_flow?: string | null
          blocks_clocking?: boolean | null
          cap_per_year_unit?: string | null
          cap_per_year_value?: number | null
          category?: string
          code?: string
          color?: string | null
          company_id?: string
          compute_on?: string
          convenio_reference?: string | null
          counts_as_work?: boolean | null
          created_at?: string
          description?: string | null
          duration_is_range?: boolean | null
          duration_unit?: string | null
          duration_value?: number | null
          effective_from?: string | null
          effective_to?: string | null
          extra_travel_days?: number | null
          half_day_allowed?: boolean | null
          id?: string
          incompatible_with?: Json | null
          is_active?: boolean
          is_paid?: boolean
          justification_types?: Json | null
          legal_origin?: string | null
          max_days_per_year?: number | null
          min_block_days?: number | null
          name?: string
          notes?: string | null
          preaviso_hours?: number | null
          requires_approval?: boolean
          requires_justification?: boolean
          sla_hours?: number | null
          travel_threshold_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          created_at: string
          id: string
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      calendar_holidays: {
        Row: {
          center_id: string | null
          company_id: string
          created_at: string
          description: string | null
          holiday_date: string
          holiday_type: string
          id: string
          is_working_day: boolean
          updated_at: string
        }
        Insert: {
          center_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          holiday_date: string
          holiday_type?: string
          id?: string
          is_working_day?: boolean
          updated_at?: string
        }
        Update: {
          center_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          holiday_date?: string
          holiday_type?: string
          id?: string
          is_working_day?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_downloads: {
        Row: {
          company_id: string
          created_at: string
          document_title: string
          download_type: string
          downloaded_at: string
          downloaded_by: string
          evidence_id: string | null
          id: string
          ip_address: unknown
          notification_id: string | null
          user_agent: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_title: string
          download_type: string
          downloaded_at?: string
          downloaded_by: string
          evidence_id?: string | null
          id?: string
          ip_address?: unknown
          notification_id?: string | null
          user_agent?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_title?: string
          download_type?: string
          downloaded_at?: string
          downloaded_by?: string
          evidence_id?: string | null
          id?: string
          ip_address?: unknown
          notification_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_downloads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_downloads_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_downloads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "compliance_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          address: string | null
          cif: string | null
          city: string | null
          cnae: string | null
          created_at: string
          employee_code_prefix: string
          entity_type: string | null
          id: string
          name: string
          postal_code: string | null
          sector: string | null
          settings: Json | null
          timezone: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cif?: string | null
          city?: string | null
          cnae?: string | null
          created_at?: string
          employee_code_prefix?: string
          entity_type?: string | null
          id?: string
          name: string
          postal_code?: string | null
          sector?: string | null
          settings?: Json | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cif?: string | null
          city?: string | null
          cnae?: string | null
          created_at?: string
          employee_code_prefix?: string
          entity_type?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          sector?: string | null
          settings?: Json | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          linked_correction_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["violation_severity"]
          sla_due_at: string | null
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
          violation_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          linked_correction_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["violation_severity"]
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
          violation_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          linked_correction_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["violation_severity"]
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
          violation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_linked_correction_id_fkey"
            columns: ["linked_correction_id"]
            isOneToOne: false
            referencedRelation: "correction_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "compliance_violations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_notifications: {
        Row: {
          body_json: Json
          channel: Database["public"]["Enums"]["notification_channel"]
          company_id: string
          content_hash: string | null
          created_at: string
          error_message: string | null
          failed_at: string | null
          id: string
          incident_id: string | null
          notification_type: string
          qtsp_evidence_id: string | null
          quiet_hours_delayed: boolean | null
          recipient_email: string | null
          recipient_employee_id: string | null
          recipient_user_id: string | null
          scheduled_for: string
          sent_at: string | null
          subject: string | null
          violation_id: string | null
        }
        Insert: {
          body_json?: Json
          channel?: Database["public"]["Enums"]["notification_channel"]
          company_id: string
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          incident_id?: string | null
          notification_type: string
          qtsp_evidence_id?: string | null
          quiet_hours_delayed?: boolean | null
          recipient_email?: string | null
          recipient_employee_id?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          subject?: string | null
          violation_id?: string | null
        }
        Update: {
          body_json?: Json
          channel?: Database["public"]["Enums"]["notification_channel"]
          company_id?: string
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          incident_id?: string | null
          notification_type?: string
          qtsp_evidence_id?: string | null
          quiet_hours_delayed?: boolean | null
          recipient_email?: string | null
          recipient_employee_id?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          subject?: string | null
          violation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "compliance_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_qtsp_evidence_id_fkey"
            columns: ["qtsp_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_recipient_employee_id_fkey"
            columns: ["recipient_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "compliance_violations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_violations: {
        Row: {
          auto_resolved_at: string | null
          company_id: string
          created_at: string
          detected_at: string
          employee_id: string
          evidence_json: Json
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_code: string
          rule_version_id: string | null
          severity: Database["public"]["Enums"]["violation_severity"]
          status: Database["public"]["Enums"]["violation_status"]
          updated_at: string
          violation_date: string
        }
        Insert: {
          auto_resolved_at?: string | null
          company_id: string
          created_at?: string
          detected_at?: string
          employee_id: string
          evidence_json?: Json
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code: string
          rule_version_id?: string | null
          severity?: Database["public"]["Enums"]["violation_severity"]
          status?: Database["public"]["Enums"]["violation_status"]
          updated_at?: string
          violation_date: string
        }
        Update: {
          auto_resolved_at?: string | null
          company_id?: string
          created_at?: string
          detected_at?: string
          employee_id?: string
          evidence_json?: Json
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code?: string
          rule_version_id?: string | null
          severity?: Database["public"]["Enums"]["violation_severity"]
          status?: Database["public"]["Enums"]["violation_status"]
          updated_at?: string
          violation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_violations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contingency_records: {
        Row: {
          company_id: string
          contingency_date: string
          created_at: string
          employee_id: string
          employee_signature_confirmed: boolean
          entry_time: string | null
          exit_time: string | null
          id: string
          notes: string | null
          paper_form_reference: string | null
          pause_end: string | null
          pause_start: string | null
          reason: string
          supervisor_signature_confirmed: boolean
          time_events_created: boolean
          transcribed_at: string
          transcribed_by: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          company_id: string
          contingency_date: string
          created_at?: string
          employee_id: string
          employee_signature_confirmed?: boolean
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          notes?: string | null
          paper_form_reference?: string | null
          pause_end?: string | null
          pause_start?: string | null
          reason: string
          supervisor_signature_confirmed?: boolean
          time_events_created?: boolean
          transcribed_at?: string
          transcribed_by: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          company_id?: string
          contingency_date?: string
          created_at?: string
          employee_id?: string
          employee_signature_confirmed?: boolean
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          notes?: string | null
          paper_form_reference?: string | null
          pause_end?: string | null
          pause_start?: string | null
          reason?: string
          supervisor_signature_confirmed?: boolean
          time_events_created?: boolean
          transcribed_at?: string
          transcribed_by?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contingency_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contingency_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      coverage_rules: {
        Row: {
          approval_overrides: boolean
          blackout_ranges: Json
          center_id: string | null
          company_id: string
          created_at: string
          department: string | null
          id: string
          is_active: boolean
          job_profile: string | null
          max_simultaneous_absences: number | null
          min_team_available_pct: number
          priority: number
          updated_at: string
        }
        Insert: {
          approval_overrides?: boolean
          blackout_ranges?: Json
          center_id?: string | null
          company_id: string
          created_at?: string
          department?: string | null
          id?: string
          is_active?: boolean
          job_profile?: string | null
          max_simultaneous_absences?: number | null
          min_team_available_pct?: number
          priority?: number
          updated_at?: string
        }
        Update: {
          approval_overrides?: boolean
          blackout_ranges?: Json
          center_id?: string | null
          company_id?: string
          created_at?: string
          department?: string | null
          id?: string
          is_active?: boolean
          job_profile?: string | null
          max_simultaneous_absences?: number | null
          min_team_available_pct?: number
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
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
      data_purge_log: {
        Row: {
          company_id: string
          content_hash_before: string
          created_at: string
          data_category: string
          id: string
          newest_record_date: string | null
          oldest_record_date: string | null
          purge_cutoff_date: string
          purged_at: string
          purged_by: string
          qtsp_evidence_id: string | null
          records_purged: number
        }
        Insert: {
          company_id: string
          content_hash_before: string
          created_at?: string
          data_category: string
          id?: string
          newest_record_date?: string | null
          oldest_record_date?: string | null
          purge_cutoff_date: string
          purged_at?: string
          purged_by?: string
          qtsp_evidence_id?: string | null
          records_purged: number
        }
        Update: {
          company_id?: string
          content_hash_before?: string
          created_at?: string
          data_category?: string
          id?: string
          newest_record_date?: string | null
          oldest_record_date?: string | null
          purge_cutoff_date?: string
          purged_at?: string
          purged_by?: string
          qtsp_evidence_id?: string | null
          records_purged?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_purge_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_purge_log_qtsp_evidence_id_fkey"
            columns: ["qtsp_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_config: {
        Row: {
          company_id: string
          created_at: string
          data_category: string
          description: string | null
          id: string
          is_active: boolean
          retention_years: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data_category: string
          description?: string | null
          id?: string
          is_active?: boolean
          retention_years: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data_category?: string
          description?: string | null
          id?: string
          is_active?: boolean
          retention_years?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_retention_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acknowledgments: {
        Row: {
          acknowledged_at: string
          company_id: string
          content_hash: string
          created_at: string
          document_id: string
          employee_id: string
          id: string
          ip_address: unknown
          qtsp_evidence_id: string | null
          signature_hash: string
          tsp_timestamp: string | null
          tsp_token: string | null
          user_agent: string | null
        }
        Insert: {
          acknowledged_at?: string
          company_id: string
          content_hash: string
          created_at?: string
          document_id: string
          employee_id: string
          id?: string
          ip_address?: unknown
          qtsp_evidence_id?: string | null
          signature_hash: string
          tsp_timestamp?: string | null
          tsp_token?: string | null
          user_agent?: string | null
        }
        Update: {
          acknowledged_at?: string
          company_id?: string
          content_hash?: string
          created_at?: string
          document_id?: string
          employee_id?: string
          id?: string
          ip_address?: unknown
          qtsp_evidence_id?: string | null
          signature_hash?: string
          tsp_timestamp?: string | null
          tsp_token?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgments_qtsp_evidence_id_fkey"
            columns: ["qtsp_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
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
          backoff_seconds: number | null
          completed_at: string | null
          created_at: string
          daily_root_id: string | null
          error_message: string | null
          evidence_group_id: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          external_id: string | null
          id: string
          last_retry_at: string | null
          next_retry_at: string | null
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
          backoff_seconds?: number | null
          completed_at?: string | null
          created_at?: string
          daily_root_id?: string | null
          error_message?: string | null
          evidence_group_id: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          external_id?: string | null
          id?: string
          last_retry_at?: string | null
          next_retry_at?: string | null
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
          backoff_seconds?: number | null
          completed_at?: string | null
          created_at?: string
          daily_root_id?: string | null
          error_message?: string | null
          evidence_group_id?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          external_id?: string | null
          id?: string
          last_retry_at?: string | null
          next_retry_at?: string | null
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
      employee_documents: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          document_type: string
          employee_id: string
          file_path: string
          file_size: number | null
          id: string
          is_verified: boolean | null
          mime_type: string | null
          related_request_id: string | null
          title: string
          uploaded_by: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          document_type: string
          employee_id: string
          file_path: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          related_request_id?: string | null
          title: string
          uploaded_by: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          document_type?: string
          employee_id?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          related_request_id?: string | null
          title?: string
          uploaded_by?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "absence_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_notifications: {
        Row: {
          action_url: string | null
          company_id: string
          content_hash: string | null
          created_at: string
          employee_id: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          qtsp_evidence_id: string | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          company_id: string
          content_hash?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          qtsp_evidence_id?: string | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          company_id?: string
          content_hash?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          qtsp_evidence_id?: string | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_notifications_qtsp_evidence_id_fkey"
            columns: ["qtsp_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
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
          is_department_responsible: boolean | null
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
          is_department_responsible?: boolean | null
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
          is_department_responsible?: boolean | null
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
      escalation_history: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          company_id: string | null
          error_category: string | null
          error_message: string | null
          escalation_level: number
          id: string
          notification_channel: string | null
          notification_sent: boolean | null
          qtsp_log_id: string | null
          resolved_at: string | null
          rule_id: string | null
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          company_id?: string | null
          error_category?: string | null
          error_message?: string | null
          escalation_level: number
          id?: string
          notification_channel?: string | null
          notification_sent?: boolean | null
          qtsp_log_id?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          company_id?: string | null
          error_category?: string | null
          error_message?: string | null
          escalation_level?: number
          id?: string
          notification_channel?: string | null
          notification_sent?: boolean | null
          qtsp_log_id?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_history_qtsp_log_id_fkey"
            columns: ["qtsp_log_id"]
            isOneToOne: false
            referencedRelation: "qtsp_audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "escalation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          company_id: string | null
          consecutive_failures_threshold: number | null
          created_at: string
          id: string
          is_active: boolean | null
          level: number
          notify_emails: string[]
          notify_in_app: boolean | null
          severity_threshold: string
          time_threshold_minutes: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          consecutive_failures_threshold?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          level?: number
          notify_emails?: string[]
          notify_in_app?: boolean | null
          severity_threshold: string
          time_threshold_minutes?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          consecutive_failures_threshold?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          level?: number
          notify_emails?: string[]
          notify_in_app?: boolean | null
          severity_threshold?: string
          time_threshold_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      itss_packages: {
        Row: {
          centers: Json | null
          company_id: string
          components: Json
          created_at: string
          expedient_number: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          manifest: Json | null
          package_hash: string | null
          period_end: string
          period_start: string
          qtsp_evidence_id: string | null
          request_date: string | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          centers?: Json | null
          company_id: string
          components?: Json
          created_at?: string
          expedient_number?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          manifest?: Json | null
          package_hash?: string | null
          period_end: string
          period_start: string
          qtsp_evidence_id?: string | null
          request_date?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          centers?: Json | null
          company_id?: string
          components?: Json
          created_at?: string
          expedient_number?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          manifest?: Json | null
          package_hash?: string | null
          period_end?: string
          period_start?: string
          qtsp_evidence_id?: string | null
          request_date?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itss_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itss_packages_qtsp_evidence_id_fkey"
            columns: ["qtsp_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_notifications: {
        Row: {
          actioned_at: string | null
          company_id: string
          created_at: string
          dismissed_at: string | null
          employee_id: string
          expires_at: string | null
          id: string
          notification_type: string
          preview: string | null
          priority: string
          reference_id: string | null
          shown_at: string | null
          status: string
          title: string
        }
        Insert: {
          actioned_at?: string | null
          company_id: string
          created_at?: string
          dismissed_at?: string | null
          employee_id: string
          expires_at?: string | null
          id?: string
          notification_type: string
          preview?: string | null
          priority?: string
          reference_id?: string | null
          shown_at?: string | null
          status?: string
          title: string
        }
        Update: {
          actioned_at?: string | null
          company_id?: string
          created_at?: string
          dismissed_at?: string | null
          employee_id?: string
          expires_at?: string | null
          id?: string
          notification_type?: string
          preview?: string | null
          priority?: string
          reference_id?: string | null
          shown_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_sessions: {
        Row: {
          activated_by: string | null
          company_id: string
          created_at: string | null
          device_name: string | null
          device_token_hash: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_seen_at: string | null
          terminal_id: string | null
          updated_at: string | null
        }
        Insert: {
          activated_by?: string | null
          company_id: string
          created_at?: string | null
          device_name?: string | null
          device_token_hash: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          terminal_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_by?: string | null
          company_id?: string
          created_at?: string | null
          device_name?: string | null
          device_token_hash?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          terminal_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_sessions_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_calendars: {
        Row: {
          center_id: string | null
          company_id: string
          created_at: string
          holidays: Json
          id: string
          intensive_periods: Json | null
          name: string
          published_at: string | null
          shifts_summary: Json | null
          updated_at: string
          year: number
        }
        Insert: {
          center_id?: string | null
          company_id: string
          created_at?: string
          holidays?: Json
          id?: string
          intensive_periods?: Json | null
          name: string
          published_at?: string | null
          shifts_summary?: Json | null
          updated_at?: string
          year: number
        }
        Update: {
          center_id?: string | null
          company_id?: string
          created_at?: string
          holidays?: Json
          id?: string
          intensive_periods?: Json | null
          name?: string
          published_at?: string | null
          shifts_summary?: Json | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "labor_calendars_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_templates: {
        Row: {
          category: string
          code: string
          content_markdown: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: string
          requires_employee_acceptance: boolean
          updated_at: string
          variable_fields: Json
          version: number
        }
        Insert: {
          category: string
          code: string
          content_markdown: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: string
          requires_employee_acceptance?: boolean
          updated_at?: string
          variable_fields?: Json
          version?: number
        }
        Update: {
          category?: string
          code?: string
          content_markdown?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: string
          requires_employee_acceptance?: boolean
          updated_at?: string
          variable_fields?: Json
          version?: number
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          code: string
          company_id: string
          content_html: string | null
          content_markdown: string
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          is_published: boolean
          name: string
          pdf_path: string | null
          published_at: string | null
          published_by: string | null
          template_id: string
          updated_at: string
          variable_values: Json
          version: number
        }
        Insert: {
          code: string
          company_id: string
          content_html?: string | null
          content_markdown: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_published?: boolean
          name: string
          pdf_path?: string | null
          published_at?: string | null
          published_by?: string | null
          template_id: string
          updated_at?: string
          variable_values?: Json
          version?: number
        }
        Update: {
          code?: string
          company_id?: string
          content_html?: string | null
          content_markdown?: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_published?: boolean
          name?: string
          pdf_path?: string | null
          published_at?: string | null
          published_by?: string | null
          template_id?: string
          updated_at?: string
          variable_values?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "legal_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_docs: {
        Row: {
          access_scope: string
          company_id: string
          created_at: string
          employee_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          request_id: string
          retention_until: string | null
          scope: string
          uploaded_by: string
        }
        Insert: {
          access_scope?: string
          company_id: string
          created_at?: string
          employee_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          request_id: string
          retention_until?: string | null
          scope?: string
          uploaded_by: string
        }
        Update: {
          access_scope?: string
          company_id?: string
          created_at?: string
          employee_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          request_id?: string
          retention_until?: string | null
          scope?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_docs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_docs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_docs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "absence_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      message_contents: {
        Row: {
          attachments: Json | null
          body_html: string | null
          body_markdown: string | null
          body_text: string | null
          created_at: string
          form_schema: Json | null
          id: string
          is_current: boolean
          thread_id: string
          version: number
        }
        Insert: {
          attachments?: Json | null
          body_html?: string | null
          body_markdown?: string | null
          body_text?: string | null
          created_at?: string
          form_schema?: Json | null
          id?: string
          is_current?: boolean
          thread_id: string
          version?: number
        }
        Update: {
          attachments?: Json | null
          body_html?: string | null
          body_markdown?: string | null
          body_text?: string | null
          created_at?: string
          form_schema?: Json | null
          id?: string
          is_current?: boolean
          thread_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_contents_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_evidence: {
        Row: {
          company_id: string
          content_hash: string
          created_at: string
          device_info: Json | null
          event_data: Json
          event_timestamp: string
          event_type: string
          id: string
          ip_address: unknown
          previous_hash: string | null
          qtsp_provider: string | null
          qtsp_serial: string | null
          qtsp_timestamp: string | null
          qtsp_token: string | null
          recipient_id: string | null
          thread_id: string
        }
        Insert: {
          company_id: string
          content_hash: string
          created_at?: string
          device_info?: Json | null
          event_data?: Json
          event_timestamp: string
          event_type: string
          id?: string
          ip_address?: unknown
          previous_hash?: string | null
          qtsp_provider?: string | null
          qtsp_serial?: string | null
          qtsp_timestamp?: string | null
          qtsp_token?: string | null
          recipient_id?: string | null
          thread_id: string
        }
        Update: {
          company_id?: string
          content_hash?: string
          created_at?: string
          device_info?: Json | null
          event_data?: Json
          event_timestamp?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          previous_hash?: string | null
          qtsp_provider?: string | null
          qtsp_serial?: string | null
          qtsp_timestamp?: string | null
          qtsp_token?: string | null
          recipient_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_evidence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_evidence_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "message_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_evidence_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          company_id: string
          created_at: string
          delivered_at: string | null
          delivery_evidence_id: string | null
          delivery_status: string
          employee_id: string
          first_read_at: string | null
          id: string
          last_read_at: string | null
          last_reminder_at: string | null
          next_reminder_at: string | null
          notified_email_at: string | null
          notified_kiosk_at: string | null
          notified_push_at: string | null
          read_count: number
          read_device_id: string | null
          read_device_type: string | null
          read_evidence_id: string | null
          read_ip: unknown
          read_user_agent: string | null
          reminder_count: number
          responded_at: string | null
          response_attachments: Json | null
          response_evidence_id: string | null
          response_form_data: Json | null
          response_text: string | null
          signature_data: Json | null
          signature_evidence_id: string | null
          signed_at: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_evidence_id?: string | null
          delivery_status?: string
          employee_id: string
          first_read_at?: string | null
          id?: string
          last_read_at?: string | null
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          notified_email_at?: string | null
          notified_kiosk_at?: string | null
          notified_push_at?: string | null
          read_count?: number
          read_device_id?: string | null
          read_device_type?: string | null
          read_evidence_id?: string | null
          read_ip?: unknown
          read_user_agent?: string | null
          reminder_count?: number
          responded_at?: string | null
          response_attachments?: Json | null
          response_evidence_id?: string | null
          response_form_data?: Json | null
          response_text?: string | null
          signature_data?: Json | null
          signature_evidence_id?: string | null
          signed_at?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_evidence_id?: string | null
          delivery_status?: string
          employee_id?: string
          first_read_at?: string | null
          id?: string
          last_read_at?: string | null
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          notified_email_at?: string | null
          notified_kiosk_at?: string | null
          notified_push_at?: string | null
          read_count?: number
          read_device_id?: string | null
          read_device_type?: string | null
          read_evidence_id?: string | null
          read_ip?: unknown
          read_user_agent?: string | null
          reminder_count?: number
          responded_at?: string | null
          response_attachments?: Json | null
          response_evidence_id?: string | null
          response_form_data?: Json | null
          response_text?: string | null
          signature_data?: Json | null
          signature_evidence_id?: string | null
          signed_at?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_delivery_evidence_id_fkey"
            columns: ["delivery_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_read_evidence_id_fkey"
            columns: ["read_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_response_evidence_id_fkey"
            columns: ["response_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_signature_evidence_id_fkey"
            columns: ["signature_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          available_variables: Json | null
          body_template: string
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          default_certification_level: string | null
          default_priority: string | null
          default_requires_read: boolean | null
          default_requires_response: boolean | null
          default_requires_signature: boolean | null
          default_response_days: number | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          subject_template: string
          thread_type: string
          updated_at: string
        }
        Insert: {
          available_variables?: Json | null
          body_template: string
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          default_certification_level?: string | null
          default_priority?: string | null
          default_requires_read?: boolean | null
          default_requires_response?: boolean | null
          default_requires_signature?: boolean | null
          default_response_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          subject_template: string
          thread_type: string
          updated_at?: string
        }
        Update: {
          available_variables?: Json | null
          body_template?: string
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          default_certification_level?: string | null
          default_priority?: string | null
          default_requires_read?: boolean | null
          default_requires_response?: boolean | null
          default_requires_signature?: boolean | null
          default_response_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          subject_template?: string
          thread_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          allow_reply: boolean
          audience_filter: Json | null
          audience_type: string
          category: string | null
          certification_level: string
          closed_at: string | null
          company_id: string
          content_hash: string | null
          created_at: string
          created_by: string
          id: string
          on_behalf_of: string | null
          priority: string
          recipient_count: number | null
          requires_read_confirmation: boolean
          requires_response: boolean
          requires_signature: boolean
          response_deadline: string | null
          scheduled_at: string | null
          sender_role: string | null
          sent_at: string | null
          status: string
          subject: string
          tags: Json | null
          thread_type: string
          updated_at: string
        }
        Insert: {
          allow_reply?: boolean
          audience_filter?: Json | null
          audience_type: string
          category?: string | null
          certification_level?: string
          closed_at?: string | null
          company_id: string
          content_hash?: string | null
          created_at?: string
          created_by: string
          id?: string
          on_behalf_of?: string | null
          priority?: string
          recipient_count?: number | null
          requires_read_confirmation?: boolean
          requires_response?: boolean
          requires_signature?: boolean
          response_deadline?: string | null
          scheduled_at?: string | null
          sender_role?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          tags?: Json | null
          thread_type: string
          updated_at?: string
        }
        Update: {
          allow_reply?: boolean
          audience_filter?: Json | null
          audience_type?: string
          category?: string | null
          certification_level?: string
          closed_at?: string | null
          company_id?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string
          id?: string
          on_behalf_of?: string | null
          priority?: string
          recipient_count?: number | null
          requires_read_confirmation?: boolean
          requires_response?: boolean
          requires_signature?: boolean
          response_deadline?: string | null
          scheduled_at?: string | null
          sender_role?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          tags?: Json | null
          thread_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closures: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          evidence_id: string | null
          id: string
          month: number
          night_hours: number
          overtime_hours: number
          regular_hours: number
          sealed_pdf_path: string | null
          signature_hash: string | null
          signed_at: string | null
          status: string
          summary_json: Json
          total_hours: number
          updated_at: string
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          evidence_id?: string | null
          id?: string
          month: number
          night_hours?: number
          overtime_hours?: number
          regular_hours?: number
          sealed_pdf_path?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          status?: string
          summary_json?: Json
          total_hours?: number
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          evidence_id?: string | null
          id?: string
          month?: number
          night_hours?: number
          overtime_hours?: number
          regular_hours?: number
          sealed_pdf_path?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          status?: string
          summary_json?: Json
          total_hours?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closures_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
        ]
      }
      national_holidays: {
        Row: {
          created_at: string | null
          holiday_date: string
          id: string
          name: string
          region: string | null
          type: string
          year: number
        }
        Insert: {
          created_at?: string | null
          holiday_date: string
          id?: string
          name: string
          region?: string | null
          type: string
          year: number
        }
        Update: {
          created_at?: string | null
          holiday_date?: string
          id?: string
          name?: string
          region?: string | null
          type?: string
          year?: number
        }
        Relationships: []
      }
      qtsp_audit_log: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          evidence_id: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          evidence_id?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          evidence_id?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "qtsp_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qtsp_audit_log_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          center_id: string | null
          company_id: string
          created_at: string
          department: string | null
          employee_id: string | null
          fallback_policy: string | null
          id: string
          is_active: boolean
          priority: number
          rule_version_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          center_id?: string | null
          company_id: string
          created_at?: string
          department?: string | null
          employee_id?: string | null
          fallback_policy?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_version_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          center_id?: string | null
          company_id?: string
          created_at?: string
          department?: string | null
          employee_id?: string | null
          fallback_policy?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_assignments_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_sets: {
        Row: {
          company_id: string | null
          convenio: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_template: boolean
          name: string
          sector: string | null
          status: Database["public"]["Enums"]["rule_set_status"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          convenio?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          sector?: string | null
          status?: Database["public"]["Enums"]["rule_set_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          convenio?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          sector?: string | null
          status?: Database["public"]["Enums"]["rule_set_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_sets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_versions: {
        Row: {
          created_at: string
          dt_evidence_id: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          payload_hash: string | null
          payload_json: Json
          published_at: string | null
          published_by: string | null
          rule_set_id: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          dt_evidence_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          payload_hash?: string | null
          payload_json?: Json
          published_at?: string | null
          published_by?: string | null
          rule_set_id: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          dt_evidence_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          payload_hash?: string | null
          payload_json?: Json
          published_at?: string | null
          published_by?: string | null
          rule_set_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_versions_dt_evidence_id_fkey"
            columns: ["dt_evidence_id"]
            isOneToOne: false
            referencedRelation: "dt_evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_versions_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to_employee_id: string | null
          assigned_to_user_id: string | null
          category: string | null
          company_id: string | null
          conversation_context: Json | null
          created_at: string
          created_by_employee_id: string | null
          created_by_user_id: string
          description: string
          id: string
          priority: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to_employee_id?: string | null
          assigned_to_user_id?: string | null
          category?: string | null
          company_id?: string | null
          conversation_context?: Json | null
          created_at?: string
          created_by_employee_id?: string | null
          created_by_user_id: string
          description: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to_employee_id?: string | null
          assigned_to_user_id?: string | null
          category?: string | null
          company_id?: string | null
          conversation_context?: Json | null
          created_at?: string
          created_by_employee_id?: string | null
          created_by_user_id?: string
          description?: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      template_absence_links: {
        Row: {
          absence_type_id: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          mapping_config: Json
          rule_version_id: string | null
          template_leave_code: string
          updated_at: string
        }
        Insert: {
          absence_type_id: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          mapping_config?: Json
          rule_version_id?: string | null
          template_leave_code: string
          updated_at?: string
        }
        Update: {
          absence_type_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          mapping_config?: Json
          rule_version_id?: string | null
          template_leave_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_absence_links_absence_type_id_fkey"
            columns: ["absence_type_id"]
            isOneToOne: false
            referencedRelation: "absence_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_absence_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_absence_links_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "rule_versions"
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
      vacation_balances: {
        Row: {
          accrual_type: string
          available_days: number | null
          carried_over_days: number
          company_id: string
          created_at: string
          devengado_days: number
          employee_id: string
          entitled_days: number
          id: string
          last_calc_at: string | null
          notes: string | null
          pending_days: number
          policy: Json | null
          total_hours_equiv: number | null
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          accrual_type?: string
          available_days?: number | null
          carried_over_days?: number
          company_id: string
          created_at?: string
          devengado_days?: number
          employee_id: string
          entitled_days?: number
          id?: string
          last_calc_at?: string | null
          notes?: string | null
          pending_days?: number
          policy?: Json | null
          total_hours_equiv?: number | null
          updated_at?: string
          used_days?: number
          year: number
        }
        Update: {
          accrual_type?: string
          available_days?: number | null
          carried_over_days?: number
          company_id?: string
          created_at?: string
          devengado_days?: number
          employee_id?: string
          entitled_days?: number
          id?: string
          last_calc_at?: string | null
          notes?: string | null
          pending_days?: number
          policy?: Json | null
          total_hours_equiv?: number | null
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vacation_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_working_days: {
        Args: {
          p_center_id: string
          p_company_id: string
          p_end_date: string
          p_start_date: string
          p_weekend_days?: number[]
        }
        Returns: number
      }
      get_employee_id: { Args: { _user_id: string }; Returns: string }
      get_employee_id_for_user: { Args: { user_uuid: string }; Returns: string }
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
      seed_default_absence_types: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_default_retention_config: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_company_admin: {
        Args: { comp_id: string; user_uuid: string }
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
      evidence_type:
        | "daily_timestamp"
        | "monthly_report"
        | "overtime_report"
        | "breaks_report"
        | "night_work_report"
        | "notification_certificate"
        | "message_hash"
        | "acknowledgment"
        | "notification_hash"
      incident_status:
        | "open"
        | "acknowledged"
        | "in_progress"
        | "resolved"
        | "closed"
      message_priority: "low" | "normal" | "high" | "urgent"
      message_sender_type: "company" | "employee"
      notification_channel: "in_app" | "email" | "both"
      rule_set_status:
        | "draft"
        | "validating"
        | "published"
        | "active"
        | "archived"
      terminal_status: "pending" | "active" | "inactive"
      violation_severity: "info" | "warn" | "critical"
      violation_status: "open" | "acknowledged" | "resolved" | "dismissed"
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
      evidence_type: [
        "daily_timestamp",
        "monthly_report",
        "overtime_report",
        "breaks_report",
        "night_work_report",
        "notification_certificate",
        "message_hash",
        "acknowledgment",
        "notification_hash",
      ],
      incident_status: [
        "open",
        "acknowledged",
        "in_progress",
        "resolved",
        "closed",
      ],
      message_priority: ["low", "normal", "high", "urgent"],
      message_sender_type: ["company", "employee"],
      notification_channel: ["in_app", "email", "both"],
      rule_set_status: [
        "draft",
        "validating",
        "published",
        "active",
        "archived",
      ],
      terminal_status: ["pending", "active", "inactive"],
      violation_severity: ["info", "warn", "critical"],
      violation_status: ["open", "acknowledged", "resolved", "dismissed"],
    },
  },
} as const
