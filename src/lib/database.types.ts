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
      audit_findings: {
        Row: {
          assigned_to: string | null
          audit_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["finding_status"]
        }
        Insert: {
          assigned_to?: string | null
          audit_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          severity: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["finding_status"]
        }
        Update: {
          assigned_to?: string | null
          audit_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["finding_status"]
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
      documents: {
        Row: {
          approval_status: Database["public"]["Enums"]["document_workflow_status"]
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          department: string | null
          id: string
          pilot_id: string | null
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
          id?: string
          pilot_id?: string | null
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
          id?: string
          pilot_id?: string | null
          storage_path?: string
          title?: string
          uav_model?: string | null
          uploaded_by?: string | null
          version?: number
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
        ]
      }
      flight_logs: {
        Row: {
          created_at: string
          duration_minutes: number | null
          flight_date: string
          flight_request_id: string | null
          id: string
          mission_outcome: Database["public"]["Enums"]["mission_outcome"]
          pilot_id: string | null
          uav_id: string | null
          weather_conditions: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          flight_date?: string
          flight_request_id?: string | null
          id?: string
          mission_outcome?: Database["public"]["Enums"]["mission_outcome"]
          pilot_id?: string | null
          uav_id?: string | null
          weather_conditions?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          flight_date?: string
          flight_request_id?: string | null
          id?: string
          mission_outcome?: Database["public"]["Enums"]["mission_outcome"]
          pilot_id?: string | null
          uav_id?: string | null
          weather_conditions?: string | null
        }
        Relationships: [
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
            foreignKeyName: "flight_logs_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_maintenance_status"
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
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_by: string | null
          created_at: string
          id: string
          location: string | null
          pilot_id: string | null
          requested_date: string
          risk_assessment: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          uav_id: string | null
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          id?: string
          location?: string | null
          pilot_id?: string | null
          requested_date?: string
          risk_assessment?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          uav_id?: string | null
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          id?: string
          location?: string | null
          pilot_id?: string | null
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
            foreignKeyName: "flight_requests_uav_id_fkey"
            columns: ["uav_id"]
            isOneToOne: false
            referencedRelation: "uav_maintenance_status"
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
            referencedRelation: "uav_maintenance_status"
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
            referencedRelation: "uav_maintenance_status"
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
      pilots: {
        Row: {
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
          battery_cycles: number
          created_at: string
          drone_id: string
          firmware_version: string | null
          flight_hours: number
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
          battery_cycles?: number
          created_at?: string
          drone_id: string
          firmware_version?: string | null
          flight_hours?: number
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
          battery_cycles?: number
          created_at?: string
          drone_id?: string
          firmware_version?: string | null
          flight_hours?: number
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
      pilot_certificate_status: {
        Row: {
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
      uav_maintenance_status: {
        Row: {
          drone_id: string | null
          flight_hours: number | null
          flight_hours_at_service: number | null
          hours_since_service: number | null
          hours_until_service: number | null
          last_maintenance_date: string | null
          maintenance_interval_hours: number | null
          uav_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_restricted_document_category: {
        Args: { cat: Database["public"]["Enums"]["document_category"] }
        Returns: boolean
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      audit_status: "planned" | "in_progress" | "completed" | "overdue"
      audit_type: "internal" | "regulatory"
      competency_level: "beginner" | "intermediate" | "advanced" | "qualified"
      compliance_status: "compliant" | "at_risk" | "non_compliant"
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
      risk_level: "low" | "medium" | "high" | "critical"
      rpas_certificate_type:
        | "basic_operations"
        | "advanced_operations"
        | "level_1_complex"
      severity_level: "low" | "medium" | "high" | "critical"
      uav_status: "airworthy" | "maintenance" | "grounded"
      user_role:
        | "uav_admin"
        | "ops_manager"
        | "pilot"
        | "auditor"
        | "maintenance_team"
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
  public: {
    Enums: {
      approval_status: ["pending", "approved", "rejected"],
      audit_status: ["planned", "in_progress", "completed", "overdue"],
      audit_type: ["internal", "regulatory"],
      competency_level: ["beginner", "intermediate", "advanced", "qualified"],
      compliance_status: ["compliant", "at_risk", "non_compliant"],
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
      ],
      risk_level: ["low", "medium", "high", "critical"],
      rpas_certificate_type: [
        "basic_operations",
        "advanced_operations",
        "level_1_complex",
      ],
      severity_level: ["low", "medium", "high", "critical"],
      uav_status: ["airworthy", "maintenance", "grounded"],
      user_role: [
        "uav_admin",
        "ops_manager",
        "pilot",
        "auditor",
        "maintenance_team",
        "read_only",
      ],
    },
  },
} as const
