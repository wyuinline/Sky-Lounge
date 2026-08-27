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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_findings: {
        Row: {
          assigned_to: string | null
          audit_id: string | null
          created_at: string
          description: string
          due_date: string | null
          hazard_id: string | null
          id: string
          incident_id: string | null
          resulting_document_id: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["finding_status"]
          training_required: boolean
        }
        Insert: {
          assigned_to?: string | null
          audit_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          hazard_id?: string | null
          id?: string
          incident_id?: string | null
          resulting_document_id?: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["finding_status"]
          training_required?: boolean
        }
        Update: {
          assigned_to?: string | null
          audit_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          hazard_id?: string | null
          id?: string
          incident_id?: string | null
          resulting_document_id?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["finding_status"]
          training_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "hazard_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "hazards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_resulting_document_id_fkey"
            columns: ["resulting_document_id"]
            isOneToOne: false
            referencedRelation: "document_review_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_resulting_document_id_fkey"
            columns: ["resulting_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          audit_date: string
          audit_type: Database["public"]["Enums"]["audit_type"]
          auditor_id: string | null
          compliance_status:
            | Database["public"]["Enums"]["compliance_status"]
            | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["audit_status"]
        }
        Insert: {
          audit_date: string
          audit_type: Database["public"]["Enums"]["audit_type"]
          auditor_id?: string | null
          compliance_status?:
            | Database["public"]["Enums"]["compliance_status"]
            | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["audit_status"]
        }
        Update: {
          audit_date?: string
          audit_type?: Database["public"]["Enums"]["audit_type"]
          auditor_id?: string | null
          compliance_status?:
            | Database["public"]["Enums"]["compliance_status"]
            | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["audit_status"]
        }
        Relationships: [
          {
            foreignKeyName: "audits_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batteries: {
        Row: {
          baseline_cycles: number
          battery_id: string
          capacity_mah: number | null
          cell_count: number | null
          created_at: string
          cycle_limit: number | null
          id: string
          location_site: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          purchased_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["battery_status"]
          updated_at: string
        }
        Insert: {
          baseline_cycles?: number
          battery_id: string
          capacity_mah?: number | null
          cell_count?: number | null
          created_at?: string
          cycle_limit?: number | null
          id?: string
          location_site?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          purchased_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["battery_status"]
          updated_at?: string
        }
        Update: {
          baseline_cycles?: number
          battery_id?: string
          capacity_mah?: number | null
          cell_count?: number | null
          created_at?: string
          cycle_limit?: number | null
          id?: string
          location_site?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          purchased_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["battery_status"]
          updated_at?: string
        }
        Relationships: []
      }
      checklist_completions: {
        Row: {
          all_critical_passed: boolean
          completed_at: string
          completed_by: string | null
          created_at: string
          flight_log_id: string | null
          flight_request_id: string | null
          id: string
          notes: string | null
          template_id: string
          uav_id: string | null
        }
        Insert: {
          all_critical_passed: boolean
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          flight_log_id?: string | null
          flight_request_id?: string | null
          id?: string
          notes?: string | null
          template_id: string
          uav_id?: string | null
        }
        Update: {
          all_critical_passed?: boolean
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          flight_log_id?: string | null
          flight_request_id?: string | null
          id?: string
          notes?: string | null
          template_id?: string
          uav_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_flight_log_id_fkey"
            columns: ["flight_log_id"]
            isOneToOne: false
            referencedRelation: "flight_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_flight_request_id_fkey"
            columns: ["flight_request_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "checklist_completions_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          critical: boolean
          id: string
          prompt: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          critical?: boolean
          id?: string
          prompt: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          critical?: boolean
          id?: string
          prompt?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          checked: boolean
          comment: string | null
          completion_id: string
          id: string
          item_id: string
        }
        Insert: {
          checked?: boolean
          comment?: string | null
          completion_id: string
          id?: string
          item_id: string
        }
        Update: {
          checked?: boolean
          comment?: string | null
          completion_id?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "checklist_completion_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "checklist_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          active: boolean
          applies_to_model: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to_model?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to_model?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      component_installations: {
        Row: {
          component_id: string
          created_at: string
          id: string
          installed_by: string | null
          installed_on: string
          notes: string | null
          removed_on: string | null
          uav_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          installed_by?: string | null
          installed_on?: string
          notes?: string | null
          removed_on?: string | null
          uav_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          installed_by?: string | null
          installed_on?: string
          notes?: string | null
          removed_on?: string | null
          uav_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_installations_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component_status_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_installations_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_installations_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_installations_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_installations_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "component_installations_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      components: {
        Row: {
          baseline_hours: number
          category: Database["public"]["Enums"]["component_category"]
          component_id: string
          created_at: string
          id: string
          location_site: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          purchased_date: string | null
          serial_number: string | null
          service_interval_hours: number | null
          status: Database["public"]["Enums"]["component_status"]
          updated_at: string
        }
        Insert: {
          baseline_hours?: number
          category: Database["public"]["Enums"]["component_category"]
          component_id: string
          created_at?: string
          id?: string
          location_site?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          purchased_date?: string | null
          serial_number?: string | null
          service_interval_hours?: number | null
          status?: Database["public"]["Enums"]["component_status"]
          updated_at?: string
        }
        Update: {
          baseline_hours?: number
          category?: Database["public"]["Enums"]["component_category"]
          component_id?: string
          created_at?: string
          id?: string
          location_site?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          purchased_date?: string | null
          serial_number?: string | null
          service_interval_hours?: number | null
          status?: Database["public"]["Enums"]["component_status"]
          updated_at?: string
        }
        Relationships: []
      }
      document_review_policy: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          rationale: string | null
          review_interval_months: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["document_category"]
          rationale?: string | null
          review_interval_months?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          rationale?: string | null
          review_interval_months?: number | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          approval_status: Database["public"]["Enums"]["document_workflow_status"]
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          department: string | null
          effective_date: string | null
          expires_at: string | null
          id: string
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          pilot_id: string | null
          review_interval_months: number | null
          storage_path: string
          title: string
          uav_model: string | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["document_workflow_status"]
          category: Database["public"]["Enums"]["document_category"]
          created_at?: string
          department?: string | null
          effective_date?: string | null
          expires_at?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          pilot_id?: string | null
          review_interval_months?: number | null
          storage_path: string
          title: string
          uav_model?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["document_workflow_status"]
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          department?: string | null
          effective_date?: string | null
          expires_at?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          pilot_id?: string | null
          review_interval_months?: number | null
          storage_path?: string
          title?: string
          uav_model?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_last_reviewed_by_fkey"
            columns: ["last_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_battery_usage: {
        Row: {
          battery_id: string
          created_at: string
          cycles: number
          flight_log_id: string
          id: string
        }
        Insert: {
          battery_id: string
          created_at?: string
          cycles?: number
          flight_log_id: string
          id?: string
        }
        Update: {
          battery_id?: string
          created_at?: string
          cycles?: number
          flight_log_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_battery_usage_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_battery_usage_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "battery_cell_health"
            referencedColumns: ["battery_id"]
          },
          {
            foreignKeyName: "flight_battery_usage_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "battery_status_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_battery_usage_flight_log_id_fkey"
            columns: ["flight_log_id"]
            isOneToOne: false
            referencedRelation: "flight_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_crew: {
        Row: {
          created_at: string
          flight_log_id: string
          id: string
          pilot_id: string
          role: Database["public"]["Enums"]["crew_role"]
        }
        Insert: {
          created_at?: string
          flight_log_id: string
          id?: string
          pilot_id: string
          role: Database["public"]["Enums"]["crew_role"]
        }
        Update: {
          created_at?: string
          flight_log_id?: string
          id?: string
          pilot_id?: string
          role?: Database["public"]["Enums"]["crew_role"]
        }
        Relationships: [
          {
            foreignKeyName: "flight_crew_flight_log_id_fkey"
            columns: ["flight_log_id"]
            isOneToOne: false
            referencedRelation: "flight_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_crew_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_crew_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_logs: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          airspace: Database["public"]["Enums"]["airspace_class"] | null
          battery_end_percent: number | null
          battery_start_percent: number | null
          cell_count: number | null
          created_at: string
          duration_minutes: number | null
          effective_duration_minutes: number | null
          flight_category: string | null
          flight_date: string
          flight_request_id: string | null
          id: string
          is_bvlos: boolean
          is_night: boolean
          is_over_people: boolean
          is_sheltered: boolean
          landing_at: string | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          max_altitude_m: number | null
          max_cell_spread: number | null
          max_cell_spread_at: number | null
          min_cell_voltage: number | null
          min_satellites: number | null
          min_voltage: number | null
          mission_outcome: Database["public"]["Enums"]["mission_outcome"]
          pilot_id: string | null
          project_id: string | null
          sfoc_reference: string | null
          takeoff_at: string | null
          telemetry_imported_at: string | null
          telemetry_max_distance_m: number | null
          telemetry_max_speed_ms: number | null
          telemetry_path: string | null
          telemetry_sample_count: number | null
          telemetry_source: string | null
          telemetry_track: Json | null
          telemetry_track_length_m: number | null
          temperature_c: number | null
          uav_id: string | null
          visibility_sm: number | null
          weather_conditions: string | null
          weather_observed_at: string | null
          weather_raw: string | null
          weather_station: string | null
          wind_direction_deg: number | null
          wind_speed_kt: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          airspace?: Database["public"]["Enums"]["airspace_class"] | null
          battery_end_percent?: number | null
          battery_start_percent?: number | null
          cell_count?: number | null
          created_at?: string
          duration_minutes?: number | null
          effective_duration_minutes?: number | null
          flight_category?: string | null
          flight_date?: string
          flight_request_id?: string | null
          id?: string
          is_bvlos?: boolean
          is_night?: boolean
          is_over_people?: boolean
          is_sheltered?: boolean
          landing_at?: string | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          max_altitude_m?: number | null
          max_cell_spread?: number | null
          max_cell_spread_at?: number | null
          min_cell_voltage?: number | null
          min_satellites?: number | null
          min_voltage?: number | null
          mission_outcome?: Database["public"]["Enums"]["mission_outcome"]
          pilot_id?: string | null
          project_id?: string | null
          sfoc_reference?: string | null
          takeoff_at?: string | null
          telemetry_imported_at?: string | null
          telemetry_max_distance_m?: number | null
          telemetry_max_speed_ms?: number | null
          telemetry_path?: string | null
          telemetry_sample_count?: number | null
          telemetry_source?: string | null
          telemetry_track?: Json | null
          telemetry_track_length_m?: number | null
          temperature_c?: number | null
          uav_id?: string | null
          visibility_sm?: number | null
          weather_conditions?: string | null
          weather_observed_at?: string | null
          weather_raw?: string | null
          weather_station?: string | null
          wind_direction_deg?: number | null
          wind_speed_kt?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          airspace?: Database["public"]["Enums"]["airspace_class"] | null
          battery_end_percent?: number | null
          battery_start_percent?: number | null
          cell_count?: number | null
          created_at?: string
          duration_minutes?: number | null
          effective_duration_minutes?: number | null
          flight_category?: string | null
          flight_date?: string
          flight_request_id?: string | null
          id?: string
          is_bvlos?: boolean
          is_night?: boolean
          is_over_people?: boolean
          is_sheltered?: boolean
          landing_at?: string | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          max_altitude_m?: number | null
          max_cell_spread?: number | null
          max_cell_spread_at?: number | null
          min_cell_voltage?: number | null
          min_satellites?: number | null
          min_voltage?: number | null
          mission_outcome?: Database["public"]["Enums"]["mission_outcome"]
          pilot_id?: string | null
          project_id?: string | null
          sfoc_reference?: string | null
          takeoff_at?: string | null
          telemetry_imported_at?: string | null
          telemetry_max_distance_m?: number | null
          telemetry_max_speed_ms?: number | null
          telemetry_path?: string | null
          telemetry_sample_count?: number | null
          telemetry_source?: string | null
          telemetry_track?: Json | null
          telemetry_track_length_m?: number | null
          temperature_c?: number | null
          uav_id?: string | null
          visibility_sm?: number | null
          weather_conditions?: string | null
          weather_observed_at?: string | null
          weather_raw?: string | null
          weather_station?: string | null
          wind_direction_deg?: number | null
          wind_speed_kt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_logs_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_flight_request_id_fkey"
            columns: ["flight_request_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "flight_logs_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_requests: {
        Row: {
          airspace_authorisation: string | null
          airspace_authorisation_expires: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_by: string | null
          created_at: string
          id: string
          location: string | null
          operations: Database["public"]["Enums"]["operation_type"][]
          pilot_id: string | null
          project_id: string | null
          requested_date: string
          risk_assessment: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          uav_id: string | null
        }
        Insert: {
          airspace_authorisation?: string | null
          airspace_authorisation_expires?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          id?: string
          location?: string | null
          operations?: Database["public"]["Enums"]["operation_type"][]
          pilot_id?: string | null
          project_id?: string | null
          requested_date?: string
          risk_assessment?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          uav_id?: string | null
        }
        Update: {
          airspace_authorisation?: string | null
          airspace_authorisation_expires?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          id?: string
          location?: string | null
          operations?: Database["public"]["Enums"]["operation_type"][]
          pilot_id?: string | null
          project_id?: string | null
          requested_date?: string
          risk_assessment?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          uav_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "flight_requests_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      hazard_incidents: {
        Row: {
          created_at: string
          hazard_id: string
          id: string
          incident_id: string
        }
        Insert: {
          created_at?: string
          hazard_id: string
          id?: string
          incident_id: string
        }
        Update: {
          created_at?: string
          hazard_id?: string
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hazard_incidents_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "hazard_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazard_incidents_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "hazards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazard_incidents_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      hazards: {
        Row: {
          category: Database["public"]["Enums"]["hazard_category"]
          created_at: string
          description: string | null
          hazard_code: string
          id: string
          identified_on: string
          initial_likelihood: Database["public"]["Enums"]["risk_likelihood"]
          initial_severity: Database["public"]["Enums"]["risk_severity"]
          last_reviewed_at: string | null
          mitigation: string | null
          notes: string | null
          owner_id: string | null
          residual_likelihood:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          residual_severity: Database["public"]["Enums"]["risk_severity"] | null
          review_interval_months: number
          status: Database["public"]["Enums"]["hazard_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["hazard_category"]
          created_at?: string
          description?: string | null
          hazard_code: string
          id?: string
          identified_on?: string
          initial_likelihood: Database["public"]["Enums"]["risk_likelihood"]
          initial_severity: Database["public"]["Enums"]["risk_severity"]
          last_reviewed_at?: string | null
          mitigation?: string | null
          notes?: string | null
          owner_id?: string | null
          residual_likelihood?:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          residual_severity?:
            | Database["public"]["Enums"]["risk_severity"]
            | null
          review_interval_months?: number
          status?: Database["public"]["Enums"]["hazard_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["hazard_category"]
          created_at?: string
          description?: string | null
          hazard_code?: string
          id?: string
          identified_on?: string
          initial_likelihood?: Database["public"]["Enums"]["risk_likelihood"]
          initial_severity?: Database["public"]["Enums"]["risk_severity"]
          last_reviewed_at?: string | null
          mitigation?: string | null
          notes?: string | null
          owner_id?: string | null
          residual_likelihood?:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          residual_severity?:
            | Database["public"]["Enums"]["risk_severity"]
            | null
          review_interval_months?: number
          status?: Database["public"]["Enums"]["hazard_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hazards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          incident_date: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          is_anonymous: boolean
          pilot_id: string | null
          reported_by: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["incident_status"]
          uav_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          incident_date?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          is_anonymous?: boolean
          pilot_id?: string | null
          reported_by?: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          uav_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          incident_date?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          is_anonymous?: boolean
          pilot_id?: string | null
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          uav_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "incidents_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          completed_date: string | null
          created_at: string
          flight_hours_at_service: number | null
          id: string
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          next_service_date: string | null
          notes: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          technician_id: string | null
          uav_id: string | null
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          flight_hours_at_service?: number | null
          id?: string
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          next_service_date?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          technician_id?: string | null
          uav_id?: string | null
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          flight_hours_at_service?: number | null
          id?: string
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          next_service_date?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          technician_id?: string | null
          uav_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "maintenance_records_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          notification_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          notification_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string
          due_date: string | null
          emailed_at: string | null
          entity_id: string | null
          entity_table: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          severity: Database["public"]["Enums"]["severity_level"]
          target_profile_id: string | null
          target_roles: Database["public"]["Enums"]["user_role"][]
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key: string
          due_date?: string | null
          emailed_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          severity: Database["public"]["Enums"]["severity_level"]
          target_profile_id?: string | null
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string
          due_date?: string | null
          emailed_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          severity?: Database["public"]["Enums"]["severity_level"]
          target_profile_id?: string | null
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_authorisations: {
        Row: {
          authorised_by: string | null
          authorised_on: string
          created_at: string
          evidence: string | null
          expires_on: string | null
          id: string
          notes: string | null
          operation: Database["public"]["Enums"]["operation_type"]
          pilot_id: string
          updated_at: string
        }
        Insert: {
          authorised_by?: string | null
          authorised_on?: string
          created_at?: string
          evidence?: string | null
          expires_on?: string | null
          id?: string
          notes?: string | null
          operation: Database["public"]["Enums"]["operation_type"]
          pilot_id: string
          updated_at?: string
        }
        Update: {
          authorised_by?: string | null
          authorised_on?: string
          created_at?: string
          evidence?: string | null
          expires_on?: string | null
          id?: string
          notes?: string | null
          operation?: Database["public"]["Enums"]["operation_type"]
          pilot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_authorisations_authorised_by_fkey"
            columns: ["authorised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_authorisations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_authorisations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      pilots: {
        Row: {
          active: boolean
          certificate_expires: string | null
          certificate_issued: string | null
          certificate_number: string | null
          certificate_type:
            | Database["public"]["Enums"]["rpas_certificate_type"]
            | null
          created_at: string
          flight_hours: number
          full_name: string
          id: string
          last_recency_activity: string | null
          notes: string | null
          profile_id: string | null
        }
        Insert: {
          active?: boolean
          certificate_expires?: string | null
          certificate_issued?: string | null
          certificate_number?: string | null
          certificate_type?:
            | Database["public"]["Enums"]["rpas_certificate_type"]
            | null
          created_at?: string
          flight_hours?: number
          full_name: string
          id?: string
          last_recency_activity?: string | null
          notes?: string | null
          profile_id?: string | null
        }
        Update: {
          active?: boolean
          certificate_expires?: string | null
          certificate_issued?: string | null
          certificate_number?: string | null
          certificate_type?:
            | Database["public"]["Enums"]["rpas_certificate_type"]
            | null
          created_at?: string
          flight_hours?: number
          full_name?: string
          id?: string
          last_recency_activity?: string | null
          notes?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          end_date: string | null
          hourly_rate: number | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          project_code: string
          site_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          project_code: string
          site_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          project_code?: string
          site_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          area: Database["public"]["Enums"]["access_area"]
          level: Database["public"]["Enums"]["access_level"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["access_area"]
          level?: Database["public"]["Enums"]["access_level"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["access_area"]
          level?: Database["public"]["Enums"]["access_level"]
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          certification_name: string
          competency_level:
            | Database["public"]["Enums"]["competency_level"]
            | null
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          pilot_id: string | null
          status: Database["public"]["Enums"]["currency_status"]
        }
        Insert: {
          certification_name: string
          competency_level?:
            | Database["public"]["Enums"]["competency_level"]
            | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          pilot_id?: string | null
          status?: Database["public"]["Enums"]["currency_status"]
        }
        Update: {
          certification_name?: string
          competency_level?:
            | Database["public"]["Enums"]["competency_level"]
            | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          pilot_id?: string | null
          status?: Database["public"]["Enums"]["currency_status"]
        }
        Relationships: [
          {
            foreignKeyName: "training_records_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      uavs: {
        Row: {
          assigned_pilot_id: string | null
          baseline_flight_hours: number
          created_at: string
          drone_id: string
          firmware_version: string | null
          id: string
          location_site: string | null
          maintenance_interval_hours: number | null
          manufacturer: string | null
          model: string
          next_inspection_date: string | null
          notes: string | null
          purchased_date: string | null
          registration_number: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["uav_status"]
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          assigned_pilot_id?: string | null
          baseline_flight_hours?: number
          created_at?: string
          drone_id: string
          firmware_version?: string | null
          id?: string
          location_site?: string | null
          maintenance_interval_hours?: number | null
          manufacturer?: string | null
          model: string
          next_inspection_date?: string | null
          notes?: string | null
          purchased_date?: string | null
          registration_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["uav_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          assigned_pilot_id?: string | null
          baseline_flight_hours?: number
          created_at?: string
          drone_id?: string
          firmware_version?: string | null
          id?: string
          location_site?: string | null
          maintenance_interval_hours?: number | null
          manufacturer?: string | null
          model?: string
          next_inspection_date?: string | null
          notes?: string | null
          purchased_date?: string | null
          registration_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["uav_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "uavs_assigned_pilot_id_fkey"
            columns: ["assigned_pilot_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      battery_cell_health: {
        Row: {
          battery_id: string | null
          battery_tag: string | null
          flights_with_cell_data: number | null
          last_cell_reading: string | null
          latest_spread: number | null
          lowest_cell: number | null
          status: Database["public"]["Enums"]["battery_status"] | null
          worst_spread: number | null
        }
        Relationships: []
      }
      battery_status_view: {
        Row: {
          age_months: number | null
          baseline_cycles: number | null
          battery_id: string | null
          capacity_mah: number | null
          cell_count: number | null
          created_at: string | null
          cycle_limit: number | null
          cycles_remaining: number | null
          id: string | null
          last_used_on: string | null
          location_site: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          purchased_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["battery_status"] | null
          total_cycles: number | null
        }
        Relationships: []
      }
      checklist_completion_summary: {
        Row: {
          all_critical_passed: boolean | null
          checked_count: number | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          drone_id: string | null
          flight_log_id: string | null
          flight_request_id: string | null
          id: string | null
          item_count: number | null
          notes: string | null
          template_id: string | null
          template_name: string | null
          uav_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_flight_log_id_fkey"
            columns: ["flight_log_id"]
            isOneToOne: false
            referencedRelation: "flight_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_flight_request_id_fkey"
            columns: ["flight_request_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "checklist_completions_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      component_status_view: {
        Row: {
          baseline_hours: number | null
          category: Database["public"]["Enums"]["component_category"] | null
          component_id: string | null
          created_at: string | null
          fitted_on: string | null
          fitted_to: string | null
          fitted_to_uav_id: string | null
          hours_until_service: number | null
          id: string | null
          location_site: string | null
          manufacturer: string | null
          model: string | null
          name: string | null
          notes: string | null
          purchased_date: string | null
          serial_number: string | null
          service_interval_hours: number | null
          status: Database["public"]["Enums"]["component_status"] | null
          total_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "component_installations_uav_id_fkey"
            columns: ["fitted_to_uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_installations_uav_id_fkey"
            columns: ["fitted_to_uav_id"]
            isOneToOne: false
            referencedRelation: "uav_fleet_status"
            referencedColumns: ["uav_id"]
          },
          {
            foreignKeyName: "component_installations_uav_id_fkey"
            columns: ["fitted_to_uav_id"]
            isOneToOne: false
            referencedRelation: "uavs"
            referencedColumns: ["id"]
          },
        ]
      }
      document_review_status: {
        Row: {
          approval_status:
            | Database["public"]["Enums"]["document_workflow_status"]
            | null
          category: Database["public"]["Enums"]["document_category"] | null
          created_at: string | null
          department: string | null
          effective_date: string | null
          expires_at: string | null
          id: string | null
          last_reviewed_at: string | null
          pilot_active: boolean | null
          pilot_id: string | null
          pilot_name: string | null
          pilot_profile_id: string | null
          review_due: string | null
          review_interval_months: number | null
          storage_path: string | null
          title: string | null
          uav_model: string | null
          uploaded_by: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilots_profile_id_fkey"
            columns: ["pilot_profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hazard_register: {
        Row: {
          category: Database["public"]["Enums"]["hazard_category"] | null
          created_at: string | null
          description: string | null
          hazard_code: string | null
          id: string | null
          identified_on: string | null
          incident_count: number | null
          initial_likelihood:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          initial_score: number | null
          initial_severity: Database["public"]["Enums"]["risk_severity"] | null
          last_reviewed_at: string | null
          mitigation: string | null
          notes: string | null
          open_finding_count: number | null
          owner_id: string | null
          owner_name: string | null
          residual_likelihood:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          residual_score: number | null
          residual_severity: Database["public"]["Enums"]["risk_severity"] | null
          review_due: string | null
          review_interval_months: number | null
          status: Database["public"]["Enums"]["hazard_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hazards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_authorisation_status: {
        Row: {
          authorised_by: string | null
          authorised_by_name: string | null
          authorised_on: string | null
          currently_valid: boolean | null
          evidence: string | null
          expires_on: string | null
          id: string | null
          notes: string | null
          operation: Database["public"]["Enums"]["operation_type"] | null
          pilot_active: boolean | null
          pilot_id: string | null
          pilot_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_authorisations_authorised_by_fkey"
            columns: ["authorised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_authorisations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilot_certificate_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_authorisations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_certificate_status: {
        Row: {
          active: boolean | null
          certificate_expires: string | null
          certificate_issued: string | null
          certificate_number: string | null
          certificate_type:
            | Database["public"]["Enums"]["rpas_certificate_type"]
            | null
          flight_hours: number | null
          full_name: string | null
          has_roc_a: boolean | null
          id: string | null
          last_recency_activity: string | null
          notes: string | null
          profile_id: string | null
          recency_due: string | null
        }
        Insert: {
          active?: boolean | null
          certificate_expires?: string | null
          certificate_issued?: string | null
          certificate_number?: string | null
          certificate_type?:
            | Database["public"]["Enums"]["rpas_certificate_type"]
            | null
          flight_hours?: number | null
          full_name?: string | null
          has_roc_a?: never
          id?: string | null
          last_recency_activity?: string | null
          notes?: string | null
          profile_id?: string | null
          recency_due?: never
        }
        Update: {
          active?: boolean | null
          certificate_expires?: string | null
          certificate_issued?: string | null
          certificate_number?: string | null
          certificate_type?:
            | Database["public"]["Enums"]["rpas_certificate_type"]
            | null
          flight_hours?: number | null
          full_name?: string | null
          has_roc_a?: never
          id?: string | null
          last_recency_activity?: string | null
          notes?: string | null
          profile_id?: string | null
          recency_due?: never
        }
        Relationships: [
          {
            foreignKeyName: "pilots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_summary: {
        Row: {
          aircraft_used: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          end_date: string | null
          estimated_cost: number | null
          first_flight: string | null
          flight_count: number | null
          flight_hours: number | null
          hourly_rate: number | null
          id: string | null
          last_flight: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          notes: string | null
          pilots_used: number | null
          project_code: string | null
          site_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      uav_fleet_status: {
        Row: {
          assigned_pilot_id: string | null
          assigned_pilot_name: string | null
          baseline_flight_hours: number | null
          drone_id: string | null
          flight_hours: number | null
          flight_hours_at_service: number | null
          hours_since_service: number | null
          hours_until_service: number | null
          id: string | null
          last_maintenance_date: string | null
          location_site: string | null
          maintenance_interval_hours: number | null
          manufacturer: string | null
          model: string | null
          next_inspection_date: string | null
          notes: string | null
          purchased_date: string | null
          registration_number: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["uav_status"] | null
          uav_id: string | null
          weight_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "uavs_assigned_pilot_id_fkey"
            columns: ["assigned_pilot_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      access_level_for: {
        Args: { p_area: Database["public"]["Enums"]["access_area"] }
        Returns: Database["public"]["Enums"]["access_level"]
      }
      can_create: {
        Args: { p_area: Database["public"]["Enums"]["access_area"] }
        Returns: boolean
      }
      can_manage: {
        Args: { p_area: Database["public"]["Enums"]["access_area"] }
        Returns: boolean
      }
      can_read_all: {
        Args: { p_area: Database["public"]["Enums"]["access_area"] }
        Returns: boolean
      }
      can_read_own: {
        Args: { p_area: Database["public"]["Enums"]["access_area"] }
        Returns: boolean
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_restricted_document_category: {
        Args: { cat: Database["public"]["Enums"]["document_category"] }
        Returns: boolean
      }
      likelihood_score: {
        Args: { v: Database["public"]["Enums"]["risk_likelihood"] }
        Returns: number
      }
      map_legacy_role: {
        Args: { t: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      map_legacy_roles: {
        Args: { t: string[] }
        Returns: Database["public"]["Enums"]["user_role"][]
      }
      pilot_has_roc_a: { Args: { p_pilot_id: string }; Returns: boolean }
      severity_score: {
        Args: { v: Database["public"]["Enums"]["risk_severity"] }
        Returns: number
      }
    }
    Enums: {
      access_area:
        | "fleet"
        | "maintenance"
        | "pilots"
        | "training"
        | "requests"
        | "logs"
        | "incidents"
        | "audits"
        | "docs_general"
        | "docs_restricted"
        | "roc_a"
        | "notifications"
        | "users"
        | "permissions"
      access_level: "full" | "create" | "read" | "own" | "none"
      airspace_class: "uncontrolled" | "controlled" | "restricted" | "advisory"
      approval_status: "pending" | "approved" | "rejected"
      audit_status: "planned" | "in_progress" | "completed" | "overdue"
      audit_type: "internal" | "regulatory"
      battery_status: "serviceable" | "monitor" | "retired"
      competency_level: "beginner" | "intermediate" | "advanced" | "qualified"
      compliance_status: "compliant" | "at_risk" | "non_compliant"
      component_category:
        | "motor"
        | "propeller"
        | "esc"
        | "gimbal"
        | "camera"
        | "payload"
        | "rtk_base"
        | "controller"
        | "antenna"
        | "charger"
        | "case"
        | "other"
      component_status: "in_service" | "spare" | "maintenance" | "retired"
      crew_role: "visual_observer" | "payload_operator" | "trainee"
      currency_status: "current" | "due_soon" | "expired"
      document_category:
        | "sop"
        | "policy"
        | "flight_manual"
        | "maintenance_manual"
        | "regulatory"
        | "incident_report"
        | "training_material"
        | "safety_document"
        | "roc_a"
      document_workflow_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "published"
      finding_status: "open" | "in_progress" | "closed" | "overdue"
      hazard_category:
        | "operational"
        | "technical"
        | "environmental"
        | "human_factors"
        | "regulatory"
        | "security"
      hazard_status: "open" | "mitigated" | "accepted" | "closed"
      incident_status: "open" | "investigating" | "closed" | "escalated"
      incident_type:
        | "near_miss"
        | "crash"
        | "equipment_failure"
        | "safety_hazard"
        | "regulatory_breach"
      maintenance_status: "scheduled" | "in_progress" | "overdue" | "completed"
      maintenance_type:
        | "preventive"
        | "repair"
        | "calibration"
        | "battery"
        | "firmware"
      mission_outcome: "completed" | "aborted" | "partial"
      notification_kind:
        | "certification_expiring"
        | "certification_expired"
        | "medical_expiring"
        | "medical_expired"
        | "maintenance_due"
        | "maintenance_overdue"
        | "audit_upcoming"
        | "audit_overdue"
        | "finding_overdue"
        | "maintenance_hours_due"
        | "maintenance_hours_overdue"
        | "pilot_certificate_expiring"
        | "pilot_certificate_expired"
        | "recency_due"
        | "recency_overdue"
        | "document_review_due"
        | "document_review_overdue"
        | "document_expiring"
        | "document_expired"
      operation_type:
        | "vlos"
        | "evlos"
        | "bvlos"
        | "sheltered"
        | "controlled_airspace"
        | "over_people"
        | "night"
        | "medium_rpas"
      project_status:
        | "planned"
        | "active"
        | "on_hold"
        | "complete"
        | "cancelled"
      risk_level: "low" | "medium" | "high" | "critical"
      risk_likelihood:
        | "rare"
        | "unlikely"
        | "possible"
        | "likely"
        | "almost_certain"
      risk_severity:
        | "negligible"
        | "minor"
        | "moderate"
        | "major"
        | "catastrophic"
      rpas_certificate_type:
        | "basic_operations"
        | "advanced_operations"
        | "level_1_complex"
      severity_level: "low" | "medium" | "high" | "critical"
      uav_status: "airworthy" | "maintenance" | "grounded" | "retired"
      user_role:
        | "system_admin"
        | "uav_admin"
        | "uav_lead"
        | "auditor"
        | "pilot"
        | "read_only"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_area: [
        "fleet",
        "maintenance",
        "pilots",
        "training",
        "requests",
        "logs",
        "incidents",
        "audits",
        "docs_general",
        "docs_restricted",
        "roc_a",
        "notifications",
        "users",
        "permissions",
      ],
      access_level: ["full", "create", "read", "own", "none"],
      airspace_class: ["uncontrolled", "controlled", "restricted", "advisory"],
      approval_status: ["pending", "approved", "rejected"],
      audit_status: ["planned", "in_progress", "completed", "overdue"],
      audit_type: ["internal", "regulatory"],
      battery_status: ["serviceable", "monitor", "retired"],
      competency_level: ["beginner", "intermediate", "advanced", "qualified"],
      compliance_status: ["compliant", "at_risk", "non_compliant"],
      component_category: [
        "motor",
        "propeller",
        "esc",
        "gimbal",
        "camera",
        "payload",
        "rtk_base",
        "controller",
        "antenna",
        "charger",
        "case",
        "other",
      ],
      component_status: ["in_service", "spare", "maintenance", "retired"],
      crew_role: ["visual_observer", "payload_operator", "trainee"],
      currency_status: ["current", "due_soon", "expired"],
      document_category: [
        "sop",
        "policy",
        "flight_manual",
        "maintenance_manual",
        "regulatory",
        "incident_report",
        "training_material",
        "safety_document",
        "roc_a",
      ],
      document_workflow_status: [
        "draft",
        "pending_approval",
        "approved",
        "published",
      ],
      finding_status: ["open", "in_progress", "closed", "overdue"],
      hazard_category: [
        "operational",
        "technical",
        "environmental",
        "human_factors",
        "regulatory",
        "security",
      ],
      hazard_status: ["open", "mitigated", "accepted", "closed"],
      incident_status: ["open", "investigating", "closed", "escalated"],
      incident_type: [
        "near_miss",
        "crash",
        "equipment_failure",
        "safety_hazard",
        "regulatory_breach",
      ],
      maintenance_status: ["scheduled", "in_progress", "overdue", "completed"],
      maintenance_type: [
        "preventive",
        "repair",
        "calibration",
        "battery",
        "firmware",
      ],
      mission_outcome: ["completed", "aborted", "partial"],
      notification_kind: [
        "certification_expiring",
        "certification_expired",
        "medical_expiring",
        "medical_expired",
        "maintenance_due",
        "maintenance_overdue",
        "audit_upcoming",
        "audit_overdue",
        "finding_overdue",
        "maintenance_hours_due",
        "maintenance_hours_overdue",
        "pilot_certificate_expiring",
        "pilot_certificate_expired",
        "recency_due",
        "recency_overdue",
        "document_review_due",
        "document_review_overdue",
        "document_expiring",
        "document_expired",
      ],
      operation_type: [
        "vlos",
        "evlos",
        "bvlos",
        "sheltered",
        "controlled_airspace",
        "over_people",
        "night",
        "medium_rpas",
      ],
      project_status: ["planned", "active", "on_hold", "complete", "cancelled"],
      risk_level: ["low", "medium", "high", "critical"],
      risk_likelihood: [
        "rare",
        "unlikely",
        "possible",
        "likely",
        "almost_certain",
      ],
      risk_severity: [
        "negligible",
        "minor",
        "moderate",
        "major",
        "catastrophic",
      ],
      rpas_certificate_type: [
        "basic_operations",
        "advanced_operations",
        "level_1_complex",
      ],
      severity_level: ["low", "medium", "high", "critical"],
      uav_status: ["airworthy", "maintenance", "grounded", "retired"],
      user_role: [
        "system_admin",
        "uav_admin",
        "uav_lead",
        "auditor",
        "pilot",
        "read_only",
      ],
    },
  },
} as const
