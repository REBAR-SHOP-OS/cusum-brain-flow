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
      accounting_mirror: {
        Row: {
          balance: number | null
          company_id: string
          created_at: string
          customer_id: string | null
          data: Json
          entity_type: string
          id: string
          last_synced_at: string | null
          quickbooks_id: string
        }
        Insert: {
          balance?: number | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          data: Json
          entity_type: string
          id?: string
          last_synced_at?: string | null
          quickbooks_id: string
        }
        Update: {
          balance?: number | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          data?: Json
          entity_type?: string
          id?: string
          last_synced_at?: string | null
          quickbooks_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_mirror_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      barlist_items: {
        Row: {
          bar_code: string | null
          barlist_id: string
          created_at: string
          cut_length_mm: number | null
          dims_json: Json | null
          drawing_ref: string | null
          grade: string | null
          id: string
          mark: string | null
          notes: string | null
          qty: number
          shape_code: string | null
          source_row_id: string | null
          status: string
          weight_kg: number | null
        }
        Insert: {
          bar_code?: string | null
          barlist_id: string
          created_at?: string
          cut_length_mm?: number | null
          dims_json?: Json | null
          drawing_ref?: string | null
          grade?: string | null
          id?: string
          mark?: string | null
          notes?: string | null
          qty?: number
          shape_code?: string | null
          source_row_id?: string | null
          status?: string
          weight_kg?: number | null
        }
        Update: {
          bar_code?: string | null
          barlist_id?: string
          created_at?: string
          cut_length_mm?: number | null
          dims_json?: Json | null
          drawing_ref?: string | null
          grade?: string | null
          id?: string
          mark?: string | null
          notes?: string | null
          qty?: number
          shape_code?: string | null
          source_row_id?: string | null
          status?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "barlist_items_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "barlist_items_barlist_id_fkey"
            columns: ["barlist_id"]
            isOneToOne: false
            referencedRelation: "barlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barlist_items_source_row_id_fkey"
            columns: ["source_row_id"]
            isOneToOne: false
            referencedRelation: "extract_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      barlists: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          extract_session_id: string | null
          id: string
          name: string
          parent_barlist_id: string | null
          project_id: string
          revision_no: number
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          extract_session_id?: string | null
          id?: string
          name: string
          parent_barlist_id?: string | null
          project_id: string
          revision_no?: number
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          extract_session_id?: string | null
          id?: string
          name?: string
          parent_barlist_id?: string | null
          project_id?: string
          revision_no?: number
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barlists_extract_session_id_fkey"
            columns: ["extract_session_id"]
            isOneToOne: false
            referencedRelation: "extract_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barlists_parent_barlist_id_fkey"
            columns: ["parent_barlist_id"]
            isOneToOne: false
            referencedRelation: "barlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barlists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent_type: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          agent_type?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          agent_type?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
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
          agent_color: string
          agent_name: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_color?: string
          agent_name: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_color?: string
          agent_name?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clearance_evidence: {
        Row: {
          created_at: string
          cut_plan_item_id: string
          id: string
          material_photo_url: string | null
          notes: string | null
          status: string
          tag_scan_url: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          cut_plan_item_id: string
          id?: string
          material_photo_url?: string | null
          notes?: string | null
          status?: string
          tag_scan_url?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          cut_plan_item_id?: string
          id?: string
          material_photo_url?: string | null
          notes?: string | null
          status?: string
          tag_scan_url?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clearance_evidence_cut_plan_item_id_fkey"
            columns: ["cut_plan_item_id"]
            isOneToOne: true
            referencedRelation: "cut_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      command_log: {
        Row: {
          created_at: string
          id: string
          parsed_intent: string | null
          parsed_params: Json | null
          raw_input: string
          result: string | null
          result_message: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parsed_intent?: string | null
          parsed_params?: Json | null
          raw_input: string
          result?: string | null
          result_message?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parsed_intent?: string | null
          parsed_params?: Json | null
          raw_input?: string
          result?: string | null
          result_message?: string | null
          user_id?: string
        }
        Relationships: []
      }
      communications: {
        Row: {
          body_preview: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          customer_id: string | null
          direction: string | null
          from_address: string | null
          id: string
          metadata: Json | null
          received_at: string | null
          source: string
          source_id: string
          status: string | null
          subject: string | null
          thread_id: string | null
          to_address: string | null
          user_id: string | null
        }
        Insert: {
          body_preview?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          from_address?: string | null
          id?: string
          metadata?: Json | null
          received_at?: string | null
          source: string
          source_id: string
          status?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          user_id?: string | null
        }
        Update: {
          body_preview?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          from_address?: string | null
          id?: string
          metadata?: Json | null
          received_at?: string | null
          source?: string
          source_id?: string
          status?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_access_log: {
        Row: {
          action: string
          contact_count: number | null
          contact_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          contact_count?: number | null
          contact_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          contact_count?: number | null
          contact_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_shape_schematics: {
        Row: {
          ai_analysis: string | null
          created_at: string
          id: string
          image_url: string
          shape_code: string
          uploaded_by: string | null
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string
          id?: string
          image_url: string
          shape_code: string
          uploaded_by?: string | null
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string
          id?: string
          image_url?: string
          shape_code?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string
          credit_limit: number | null
          customer_type: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          quickbooks_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          quickbooks_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          quickbooks_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cut_output_batches: {
        Row: {
          bar_code: string
          company_id: string
          created_at: string
          cut_length_mm: number
          cut_plan_item_id: string | null
          id: string
          machine_run_id: string | null
          qty_available: number
          qty_consumed: number
          qty_produced: number
          status: string
          updated_at: string
        }
        Insert: {
          bar_code: string
          company_id: string
          created_at?: string
          cut_length_mm: number
          cut_plan_item_id?: string | null
          id?: string
          machine_run_id?: string | null
          qty_available?: number
          qty_consumed?: number
          qty_produced?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bar_code?: string
          company_id?: string
          created_at?: string
          cut_length_mm?: number
          cut_plan_item_id?: string | null
          id?: string
          machine_run_id?: string | null
          qty_available?: number
          qty_consumed?: number
          qty_produced?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cut_output_batches_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "cut_output_batches_cut_plan_item_id_fkey"
            columns: ["cut_plan_item_id"]
            isOneToOne: false
            referencedRelation: "cut_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cut_output_batches_machine_run_id_fkey"
            columns: ["machine_run_id"]
            isOneToOne: false
            referencedRelation: "machine_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cut_plan_items: {
        Row: {
          asa_shape_code: string | null
          bar_code: string
          bend_completed_pieces: number
          bend_dimensions: Json | null
          bend_type: string
          completed_pieces: number
          cut_length_mm: number
          cut_plan_id: string
          drawing_ref: string | null
          id: string
          mark_number: string | null
          needs_fix: boolean
          notes: string | null
          phase: string
          pieces_per_bar: number
          qty_bars: number
          total_pieces: number
          work_order_id: string | null
        }
        Insert: {
          asa_shape_code?: string | null
          bar_code: string
          bend_completed_pieces?: number
          bend_dimensions?: Json | null
          bend_type?: string
          completed_pieces?: number
          cut_length_mm: number
          cut_plan_id: string
          drawing_ref?: string | null
          id?: string
          mark_number?: string | null
          needs_fix?: boolean
          notes?: string | null
          phase?: string
          pieces_per_bar?: number
          qty_bars: number
          total_pieces?: number
          work_order_id?: string | null
        }
        Update: {
          asa_shape_code?: string | null
          bar_code?: string
          bend_completed_pieces?: number
          bend_dimensions?: Json | null
          bend_type?: string
          completed_pieces?: number
          cut_length_mm?: number
          cut_plan_id?: string
          drawing_ref?: string | null
          id?: string
          mark_number?: string | null
          needs_fix?: boolean
          notes?: string | null
          phase?: string
          pieces_per_bar?: number
          qty_bars?: number
          total_pieces?: number
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cut_plan_items_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "cut_plan_items_cut_plan_id_fkey"
            columns: ["cut_plan_id"]
            isOneToOne: false
            referencedRelation: "cut_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cut_plan_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cut_plans: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          machine_id: string | null
          name: string
          project_id: string | null
          project_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          name: string
          project_id?: string | null
          project_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          name?: string
          project_id?: string | null
          project_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cut_plans_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cut_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          company_id: string
          created_at: string
          delivery_number: string
          driver_name: string | null
          id: string
          notes: string | null
          scheduled_date: string | null
          status: string | null
          updated_at: string
          vehicle: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_number: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string
          vehicle?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_number?: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string
          vehicle?: string | null
        }
        Relationships: []
      }
      delivery_stops: {
        Row: {
          address: string | null
          arrival_time: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          delivery_id: string
          departure_time: string | null
          exception_reason: string | null
          id: string
          notes: string | null
          order_id: string | null
          pod_photo_url: string | null
          pod_signature: string | null
          status: string | null
          stop_sequence: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          arrival_time?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          delivery_id: string
          departure_time?: string | null
          exception_reason?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          status?: string | null
          stop_sequence: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          arrival_time?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          delivery_id?: string
          departure_time?: string | null
          exception_reason?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          status?: string | null
          stop_sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stops_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_signatures: {
        Row: {
          created_at: string
          id: string
          signature_html: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          signature_html: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          signature_html?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_salaries: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          salary_amount: number
          salary_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          salary_amount: number
          salary_type?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          salary_amount?: number
          salary_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      estimation_learnings: {
        Row: {
          confidence_score: number | null
          context: string | null
          corrected_value: Json | null
          created_at: string
          created_by: string | null
          element_type: string | null
          id: string
          is_global: boolean | null
          learning_type: string
          original_value: Json | null
          project_name: string
          source_files: string[] | null
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          confidence_score?: number | null
          context?: string | null
          corrected_value?: Json | null
          created_at?: string
          created_by?: string | null
          element_type?: string | null
          id?: string
          is_global?: boolean | null
          learning_type: string
          original_value?: Json | null
          project_name: string
          source_files?: string[] | null
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          confidence_score?: number | null
          context?: string | null
          corrected_value?: Json | null
          created_at?: string
          created_by?: string | null
          element_type?: string | null
          id?: string
          is_global?: boolean | null
          learning_type?: string
          original_value?: Json | null
          project_name?: string
          source_files?: string[] | null
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      estimation_validation_rules: {
        Row: {
          created_at: string
          element_type: string | null
          error_message: string
          id: string
          is_active: boolean | null
          max_value: number | null
          min_value: number | null
          rule_name: string
          rule_type: string
          severity: string | null
          unit: string | null
          warning_message: string | null
        }
        Insert: {
          created_at?: string
          element_type?: string | null
          error_message: string
          id?: string
          is_active?: boolean | null
          max_value?: number | null
          min_value?: number | null
          rule_name: string
          rule_type: string
          severity?: string | null
          unit?: string | null
          warning_message?: string | null
        }
        Update: {
          created_at?: string
          element_type?: string | null
          error_message?: string
          id?: string
          is_active?: boolean | null
          max_value?: number | null
          min_value?: number | null
          rule_name?: string
          rule_type?: string
          severity?: string | null
          unit?: string | null
          warning_message?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          company_id: string
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      extract_errors: {
        Row: {
          created_at: string
          error_type: string
          field: string
          id: string
          message: string
          row_id: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          error_type?: string
          field: string
          id?: string
          message: string
          row_id?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          error_type?: string
          field?: string
          id?: string
          message?: string
          row_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extract_errors_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "extract_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extract_errors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "extract_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      extract_mapping: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_auto: boolean | null
          mapped_value: string
          source_field: string
          source_value: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_auto?: boolean | null
          mapped_value: string
          source_field: string
          source_value: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_auto?: boolean | null
          mapped_value?: string
          source_field?: string
          source_value?: string
        }
        Relationships: []
      }
      extract_raw_files: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          session_id: string
          status: string
          storage_path: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          session_id: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          session_id?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extract_raw_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "extract_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      extract_rows: {
        Row: {
          address: string | null
          bar_size: string | null
          bar_size_mapped: string | null
          created_at: string
          customer: string | null
          dim_a: number | null
          dim_b: number | null
          dim_c: number | null
          dim_d: number | null
          dim_e: number | null
          dim_f: number | null
          dim_g: number | null
          dim_h: number | null
          dim_j: number | null
          dim_k: number | null
          dim_o: number | null
          dim_r: number | null
          dwg: string | null
          file_id: string | null
          grade: string | null
          grade_mapped: string | null
          id: string
          item_number: string | null
          mark: string | null
          quantity: number | null
          reference: string | null
          row_index: number
          session_id: string
          shape_code_mapped: string | null
          shape_type: string | null
          status: string
          total_length_mm: number | null
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          bar_size?: string | null
          bar_size_mapped?: string | null
          created_at?: string
          customer?: string | null
          dim_a?: number | null
          dim_b?: number | null
          dim_c?: number | null
          dim_d?: number | null
          dim_e?: number | null
          dim_f?: number | null
          dim_g?: number | null
          dim_h?: number | null
          dim_j?: number | null
          dim_k?: number | null
          dim_o?: number | null
          dim_r?: number | null
          dwg?: string | null
          file_id?: string | null
          grade?: string | null
          grade_mapped?: string | null
          id?: string
          item_number?: string | null
          mark?: string | null
          quantity?: number | null
          reference?: string | null
          row_index?: number
          session_id: string
          shape_code_mapped?: string | null
          shape_type?: string | null
          status?: string
          total_length_mm?: number | null
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          bar_size?: string | null
          bar_size_mapped?: string | null
          created_at?: string
          customer?: string | null
          dim_a?: number | null
          dim_b?: number | null
          dim_c?: number | null
          dim_d?: number | null
          dim_e?: number | null
          dim_f?: number | null
          dim_g?: number | null
          dim_h?: number | null
          dim_j?: number | null
          dim_k?: number | null
          dim_o?: number | null
          dim_r?: number | null
          dwg?: string | null
          file_id?: string | null
          grade?: string | null
          grade_mapped?: string | null
          id?: string
          item_number?: string | null
          mark?: string | null
          quantity?: number | null
          reference?: string | null
          row_index?: number
          session_id?: string
          shape_code_mapped?: string | null
          shape_type?: string | null
          status?: string
          total_length_mm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extract_rows_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "extract_raw_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extract_rows_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "extract_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      extract_sessions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer: string | null
          id: string
          manifest_type: string
          name: string
          site_address: string | null
          status: string
          target_eta: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          manifest_type?: string
          name: string
          site_address?: string | null
          status?: string
          target_eta?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          manifest_type?: string
          name?: string
          site_address?: string | null
          status?: string
          target_eta?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_access_log: {
        Row: {
          action: string
          created_at: string
          entity_type: string | null
          id: string
          metadata: Json | null
          record_count: number | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          record_count?: number | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          record_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      floor_stock: {
        Row: {
          bar_code: string
          company_id: string
          id: string
          length_mm: number
          machine_id: string | null
          qty_on_hand: number
          qty_reserved: number
          updated_at: string
        }
        Insert: {
          bar_code: string
          company_id: string
          id?: string
          length_mm?: number
          machine_id?: string | null
          qty_on_hand?: number
          qty_reserved?: number
          updated_at?: string
        }
        Update: {
          bar_code?: string
          company_id?: string
          id?: string
          length_mm?: number
          machine_id?: string | null
          qty_on_hand?: number
          qty_reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_stock_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "floor_stock_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          config: Json | null
          created_at: string
          error_message: string | null
          id: string
          integration_id: string
          last_checked_at: string | null
          last_sync_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id: string
          last_checked_at?: string | null
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          last_checked_at?: string | null
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          integration_name: string
          last_synced_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_name: string
          last_synced_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_name?: string
          last_synced_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_lots: {
        Row: {
          bar_code: string
          company_id: string
          created_at: string
          id: string
          location: string | null
          lot_number: string | null
          qty_on_hand: number
          qty_reserved: number
          source: string
          standard_length_mm: number
          updated_at: string
        }
        Insert: {
          bar_code: string
          company_id: string
          created_at?: string
          id?: string
          location?: string | null
          lot_number?: string | null
          qty_on_hand?: number
          qty_reserved?: number
          source?: string
          standard_length_mm?: number
          updated_at?: string
        }
        Update: {
          bar_code?: string
          company_id?: string
          created_at?: string
          id?: string
          location?: string | null
          lot_number?: string | null
          qty_on_hand?: number
          qty_reserved?: number
          source?: string
          standard_length_mm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          bar_code: string
          company_id: string
          created_at: string
          cut_plan_id: string | null
          cut_plan_item_id: string | null
          id: string
          qty_consumed: number
          qty_reserved: number
          source_id: string
          source_type: string
          status: string
          stock_length_mm: number
          updated_at: string
        }
        Insert: {
          bar_code: string
          company_id: string
          created_at?: string
          cut_plan_id?: string | null
          cut_plan_item_id?: string | null
          id?: string
          qty_consumed?: number
          qty_reserved?: number
          source_id: string
          source_type: string
          status?: string
          stock_length_mm?: number
          updated_at?: string
        }
        Update: {
          bar_code?: string
          company_id?: string
          created_at?: string
          cut_plan_id?: string | null
          cut_plan_item_id?: string | null
          id?: string
          qty_consumed?: number
          qty_reserved?: number
          source_id?: string
          source_type?: string
          status?: string
          stock_length_mm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "inventory_reservations_cut_plan_id_fkey"
            columns: ["cut_plan_id"]
            isOneToOne: false
            referencedRelation: "cut_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_cut_plan_item_id_fkey"
            columns: ["cut_plan_item_id"]
            isOneToOne: false
            referencedRelation: "cut_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_scrap: {
        Row: {
          bar_code: string
          company_id: string
          created_at: string
          id: string
          length_mm: number
          machine_run_id: string | null
          qty: number
          reason: string | null
        }
        Insert: {
          bar_code: string
          company_id: string
          created_at?: string
          id?: string
          length_mm: number
          machine_run_id?: string | null
          qty?: number
          reason?: string | null
        }
        Update: {
          bar_code?: string
          company_id?: string
          created_at?: string
          id?: string
          length_mm?: number
          machine_run_id?: string | null
          qty?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_scrap_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "inventory_scrap_machine_run_id_fkey"
            columns: ["machine_run_id"]
            isOneToOne: false
            referencedRelation: "machine_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge: {
        Row: {
          category: string
          company_id: string
          content: string | null
          created_at: string
          id: string
          metadata: Json | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string
          metadata: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          expected_close_date: string | null
          expected_value: number | null
          id: string
          metadata: Json | null
          notes: string | null
          priority: string | null
          probability: number | null
          quote_id: string | null
          source: string | null
          source_email_id: string | null
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: string | null
          probability?: number | null
          quote_id?: string | null
          source?: string | null
          source_email_id?: string | null
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: string | null
          probability?: number | null
          quote_id?: string | null
          source?: string | null
          source_email_id?: string | null
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_capabilities: {
        Row: {
          bar_code: string
          bar_mm: number | null
          created_at: string
          id: string
          machine_id: string
          max_bars: number
          max_length_mm: number | null
          notes: string | null
          process: string
          updated_at: string
        }
        Insert: {
          bar_code: string
          bar_mm?: number | null
          created_at?: string
          id?: string
          machine_id: string
          max_bars?: number
          max_length_mm?: number | null
          notes?: string | null
          process: string
          updated_at?: string
        }
        Update: {
          bar_code?: string
          bar_mm?: number | null
          created_at?: string
          id?: string
          machine_id?: string
          max_bars?: number
          max_length_mm?: number | null
          notes?: string | null
          process?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_capabilities_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "machine_capabilities_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_queue_items: {
        Row: {
          barlist_id: string | null
          company_id: string
          created_at: string
          id: string
          machine_id: string
          position: number
          project_id: string | null
          status: string
          task_id: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          barlist_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          machine_id: string
          position?: number
          project_id?: string | null
          status?: string
          task_id: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          barlist_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          machine_id?: string
          position?: number
          project_id?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_queue_items_barlist_id_fkey"
            columns: ["barlist_id"]
            isOneToOne: false
            referencedRelation: "barlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_queue_items_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_queue_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_queue_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "production_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_queue_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_runs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          input_qty: number | null
          machine_id: string
          notes: string | null
          operator_profile_id: string | null
          output_qty: number | null
          process: string
          scrap_qty: number | null
          started_at: string | null
          status: string
          supervisor_profile_id: string | null
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          input_qty?: number | null
          machine_id: string
          notes?: string | null
          operator_profile_id?: string | null
          output_qty?: number | null
          process: string
          scrap_qty?: number | null
          started_at?: string | null
          status?: string
          supervisor_profile_id?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          input_qty?: number | null
          machine_id?: string
          notes?: string | null
          operator_profile_id?: string | null
          output_qty?: number | null
          process?: string
          scrap_qty?: number | null
          started_at?: string | null
          status?: string
          supervisor_profile_id?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_runs_operator_profile_id_fkey"
            columns: ["operator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_runs_operator_profile_id_fkey"
            columns: ["operator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_runs_supervisor_profile_id_fkey"
            columns: ["supervisor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_runs_supervisor_profile_id_fkey"
            columns: ["supervisor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_runs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          company_id: string
          created_at: string
          current_operator_profile_id: string | null
          current_run_id: string | null
          id: string
          last_event_at: string | null
          model: string | null
          name: string
          status: string
          type: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          current_operator_profile_id?: string | null
          current_run_id?: string | null
          id?: string
          last_event_at?: string | null
          model?: string | null
          name: string
          status?: string
          type: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          current_operator_profile_id?: string | null
          current_run_id?: string | null
          id?: string
          last_event_at?: string | null
          model?: string | null
          name?: string
          status?: string
          type?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_current_operator_profile_id_fkey"
            columns: ["current_operator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_current_operator_profile_id_fkey"
            columns: ["current_operator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_current_run_id_fkey"
            columns: ["current_run_id"]
            isOneToOne: false
            referencedRelation: "machine_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agent_color: string | null
          agent_name: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          link_to: string | null
          metadata: Json | null
          priority: string | null
          reminder_at: string | null
          status: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_color?: string | null
          agent_name?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          link_to?: string | null
          metadata?: Json | null
          priority?: string | null
          reminder_at?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_color?: string | null
          agent_name?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          link_to?: string | null
          metadata?: Json | null
          priority?: string | null
          reminder_at?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          order_date: string | null
          order_number: string
          quickbooks_invoice_id: string | null
          quote_id: string | null
          required_date: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number: string
          quickbooks_invoice_id?: string | null
          quote_id?: string | null
          required_date?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string
          quickbooks_invoice_id?: string | null
          quote_id?: string | null
          required_date?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          mark_number: string
          pickup_order_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mark_number: string
          pickup_order_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          mark_number?: string
          pickup_order_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pickup_order_items_pickup_order_id_fkey"
            columns: ["pickup_order_id"]
            isOneToOne: false
            referencedRelation: "pickup_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_orders: {
        Row: {
          authorized_at: string | null
          authorized_by: string | null
          bundle_count: number
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          signature_data: string | null
          site_address: string
          status: string
          updated_at: string
        }
        Insert: {
          authorized_at?: string | null
          authorized_by?: string | null
          bundle_count?: number
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          signature_data?: string | null
          site_address: string
          status?: string
          updated_at?: string
        }
        Update: {
          authorized_at?: string | null
          authorized_by?: string | null
          bundle_count?: number
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          signature_data?: string | null
          site_address?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_tasks: {
        Row: {
          asa_shape_code: string | null
          bar_code: string
          barlist_id: string | null
          bend_dimensions: Json | null
          company_id: string
          created_at: string
          created_by: string | null
          cut_length_mm: number | null
          cut_plan_id: string | null
          cut_plan_item_id: string | null
          drawing_ref: string | null
          grade: string | null
          id: string
          locked_to_machine_id: string | null
          mark_number: string | null
          notes: string | null
          priority: number
          project_id: string | null
          qty_completed: number
          qty_required: number
          setup_key: string | null
          status: string
          task_type: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          asa_shape_code?: string | null
          bar_code: string
          barlist_id?: string | null
          bend_dimensions?: Json | null
          company_id: string
          created_at?: string
          created_by?: string | null
          cut_length_mm?: number | null
          cut_plan_id?: string | null
          cut_plan_item_id?: string | null
          drawing_ref?: string | null
          grade?: string | null
          id?: string
          locked_to_machine_id?: string | null
          mark_number?: string | null
          notes?: string | null
          priority?: number
          project_id?: string | null
          qty_completed?: number
          qty_required?: number
          setup_key?: string | null
          status?: string
          task_type?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          asa_shape_code?: string | null
          bar_code?: string
          barlist_id?: string | null
          bend_dimensions?: Json | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          cut_length_mm?: number | null
          cut_plan_id?: string | null
          cut_plan_item_id?: string | null
          drawing_ref?: string | null
          grade?: string | null
          id?: string
          locked_to_machine_id?: string | null
          mark_number?: string | null
          notes?: string | null
          priority?: number
          project_id?: string | null
          qty_completed?: number
          qty_required?: number
          setup_key?: string | null
          status?: string
          task_type?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_tasks_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "production_tasks_barlist_id_fkey"
            columns: ["barlist_id"]
            isOneToOne: false
            referencedRelation: "barlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_cut_plan_id_fkey"
            columns: ["cut_plan_id"]
            isOneToOne: false
            referencedRelation: "cut_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_cut_plan_item_id_fkey"
            columns: ["cut_plan_item_id"]
            isOneToOne: false
            referencedRelation: "cut_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_locked_to_machine_id_fkey"
            columns: ["locked_to_machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          department: string | null
          duties: string[] | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          preferred_language: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          duties?: string[] | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          preferred_language?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          duties?: string[] | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          preferred_language?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          name: string
          notes: string | null
          site_address: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          name: string
          notes?: string | null
          site_address?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          site_address?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          bar_code: string
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string
          qty_ordered: number
          qty_received: number
          standard_length_mm: number
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          bar_code: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          qty_ordered?: number
          qty_received?: number
          standard_length_mm?: number
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          bar_code?: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          qty_ordered?: number
          qty_received?: number
          standard_length_mm?: number
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          received_at: string | null
          received_by: string | null
          status: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          margin_percent: number | null
          notes: string | null
          quote_number: string
          status: string | null
          total_amount: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          margin_percent?: number | null
          notes?: string | null
          quote_number: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          margin_percent?: number | null
          notes?: string | null
          quote_number?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_entries: {
        Row: {
          function_name: string
          id: string
          requested_at: string
          user_id: string
        }
        Insert: {
          function_name: string
          id?: string
          requested_at?: string
          user_id: string
        }
        Update: {
          function_name?: string
          id?: string
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rebar_sizes: {
        Row: {
          area_mm2: number
          bar_code: string
          created_at: string
          diameter_mm: number
          mass_kg_per_m: number
          standard: string
        }
        Insert: {
          area_mm2: number
          bar_code: string
          created_at?: string
          diameter_mm: number
          mass_kg_per_m: number
          standard?: string
        }
        Update: {
          area_mm2?: number
          bar_code?: string
          created_at?: string
          diameter_mm?: number
          mass_kg_per_m?: number
          standard?: string
        }
        Relationships: []
      }
      rebar_standards: {
        Row: {
          area_mm2: number | null
          bar_size: string
          bar_size_mm: number | null
          bend_radius_mult: number | null
          created_at: string
          development_length_mult: number | null
          grade: string | null
          hook_180_deduction: number | null
          hook_180_extension_mult: number | null
          hook_90_deduction: number | null
          hook_90_extension_mult: number | null
          id: string
          lap_compression_mult: number | null
          lap_tension_mult: number | null
          standard_code: string
          updated_at: string
          weight_per_meter: number
        }
        Insert: {
          area_mm2?: number | null
          bar_size: string
          bar_size_mm?: number | null
          bend_radius_mult?: number | null
          created_at?: string
          development_length_mult?: number | null
          grade?: string | null
          hook_180_deduction?: number | null
          hook_180_extension_mult?: number | null
          hook_90_deduction?: number | null
          hook_90_extension_mult?: number | null
          id?: string
          lap_compression_mult?: number | null
          lap_tension_mult?: number | null
          standard_code?: string
          updated_at?: string
          weight_per_meter: number
        }
        Update: {
          area_mm2?: number | null
          bar_size?: string
          bar_size_mm?: number | null
          bend_radius_mult?: number | null
          created_at?: string
          development_length_mult?: number | null
          grade?: string | null
          hook_180_deduction?: number | null
          hook_180_extension_mult?: number | null
          hook_90_deduction?: number | null
          hook_90_extension_mult?: number | null
          id?: string
          lap_compression_mult?: number | null
          lap_tension_mult?: number | null
          standard_code?: string
          updated_at?: string
          weight_per_meter?: number
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          clicks: number | null
          comments: number | null
          content: string
          content_type: string | null
          created_at: string
          hashtags: string[] | null
          id: string
          image_url: string | null
          impressions: number | null
          likes: number | null
          page_name: string | null
          platform: string
          reach: number | null
          saves: number | null
          scheduled_date: string | null
          shares: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          content?: string
          content_type?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          likes?: number | null
          page_name?: string | null
          platform: string
          reach?: number | null
          saves?: number | null
          scheduled_date?: string | null
          shares?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          content?: string
          content_type?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          likes?: number | null
          page_name?: string | null
          platform?: string
          reach?: number | null
          saves?: number | null
          scheduled_date?: string | null
          shares?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_strategy_checklist: {
        Row: {
          checklist_item_id: string
          completed: boolean | null
          completed_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          checklist_item_id: string
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          checklist_item_id?: string
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          category: string
          company_id: string
          context: Json | null
          created_at: string
          description: string | null
          id: string
          priority: number | null
          resolved_at: string | null
          shown_at: string | null
          shown_to: string | null
          status: string
          suggestion_type: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          company_id?: string
          context?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: number | null
          resolved_at?: string | null
          shown_at?: string | null
          shown_to?: string | null
          status?: string
          suggestion_type: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          context?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: number | null
          resolved_at?: string | null
          shown_at?: string | null
          shown_to?: string | null
          status?: string
          suggestion_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_learnings: {
        Row: {
          bar_code: string | null
          company_id: string
          context: Json
          created_at: string
          event_type: string
          id: string
          learning_type: string
          machine_id: string | null
          module: string
          resolution: string | null
          weight_adjustment: number | null
        }
        Insert: {
          bar_code?: string | null
          company_id?: string
          context?: Json
          created_at?: string
          event_type: string
          id?: string
          learning_type?: string
          machine_id?: string | null
          module: string
          resolution?: string | null
          weight_adjustment?: number | null
        }
        Update: {
          bar_code?: string | null
          company_id?: string
          context?: Json
          created_at?: string
          event_type?: string
          id?: string
          learning_type?: string
          machine_id?: string | null
          module?: string
          resolution?: string | null
          weight_adjustment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "system_learnings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_type: string | null
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          source: string | null
          source_ref: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_type?: string | null
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          source?: string | null
          source_ref?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_type?: string | null
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          source?: string | null
          source_ref?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          profile_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          profile_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channels: {
        Row: {
          channel_type: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          channel_type?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          channel_type?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_meetings: {
        Row: {
          ai_summary: string | null
          channel_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          meeting_type: string
          notes: string | null
          participants: string[] | null
          room_code: string
          started_at: string
          started_by: string
          status: string
          title: string
        }
        Insert: {
          ai_summary?: string | null
          channel_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          meeting_type?: string
          notes?: string | null
          participants?: string[] | null
          room_code: string
          started_at?: string
          started_by: string
          status?: string
          title?: string
        }
        Update: {
          ai_summary?: string | null
          channel_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          meeting_type?: string
          notes?: string | null
          participants?: string[] | null
          room_code?: string
          started_at?: string
          started_by?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_meetings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          original_language: string
          original_text: string
          sender_profile_id: string
          translations: Json
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          original_language?: string
          original_text: string
          sender_profile_id: string
          translations?: Json
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          original_language?: string
          original_text?: string
          sender_profile_id?: string
          translations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_entries: {
        Row: {
          break_minutes: number | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          profile_id: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gmail_tokens: {
        Row: {
          created_at: string
          gmail_email: string
          id: string
          last_used_at: string | null
          last_used_ip: string | null
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gmail_email: string
          id?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gmail_email?: string
          id?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_meta_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          instagram_accounts: Json | null
          last_used_at: string | null
          meta_user_id: string | null
          meta_user_name: string | null
          pages: Json | null
          platform: string
          scopes: string[] | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          instagram_accounts?: Json | null
          last_used_at?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          pages?: Json | null
          platform: string
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          instagram_accounts?: Json | null
          last_used_at?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          pages?: Json | null
          platform?: string
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_ringcentral_tokens: {
        Row: {
          access_token: string | null
          code_verifier: string | null
          created_at: string
          id: string
          rc_email: string
          refresh_token: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          code_verifier?: string | null
          created_at?: string
          id?: string
          rc_email: string
          refresh_token: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          code_verifier?: string | null
          created_at?: string
          id?: string
          rc_email?: string
          refresh_token?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      work_orders: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assigned_to: string | null
          barlist_id: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          priority: number | null
          project_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string | null
          updated_at: string
          work_order_number: string
          workstation: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_to?: string | null
          barlist_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          priority?: number | null
          project_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string | null
          updated_at?: string
          work_order_number: string
          workstation?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_to?: string | null
          barlist_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          priority?: number | null
          project_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string | null
          updated_at?: string
          work_order_number?: string
          workstation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_barlist_id_fkey"
            columns: ["barlist_id"]
            isOneToOne: false
            referencedRelation: "barlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wwm_standards: {
        Row: {
          created_at: string
          designation: string
          id: string
          overlap_mm: number | null
          sheet_length_mm: number | null
          sheet_width_mm: number | null
          spacing_mm: number
          standard_code: string
          updated_at: string
          weight_per_m2: number
          wire_diameter_mm: number
        }
        Insert: {
          created_at?: string
          designation: string
          id?: string
          overlap_mm?: number | null
          sheet_length_mm?: number | null
          sheet_width_mm?: number | null
          spacing_mm: number
          standard_code?: string
          updated_at?: string
          weight_per_m2: number
          wire_diameter_mm: number
        }
        Update: {
          created_at?: string
          designation?: string
          id?: string
          overlap_mm?: number | null
          sheet_length_mm?: number | null
          sheet_width_mm?: number | null
          spacing_mm?: number
          standard_code?: string
          updated_at?: string
          weight_per_m2?: number
          wire_diameter_mm?: number
        }
        Relationships: []
      }
    }
    Views: {
      contacts_safe: {
        Row: {
          company_id: string | null
          created_at: string | null
          customer_id: string | null
          email: string | null
          first_name: string | null
          id: string | null
          is_primary: boolean | null
          last_name: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: never
          first_name?: string | null
          id?: string | null
          is_primary?: boolean | null
          last_name?: string | null
          phone?: never
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: never
          first_name?: string | null
          id?: string | null
          is_primary?: boolean | null
          last_name?: string | null
          phone?: never
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          department: string | null
          duties: string[] | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          phone: string | null
          preferred_language: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          duties?: string[] | null
          email?: never
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: never
          preferred_language?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          duties?: string[] | null
          email?: never
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: never
          preferred_language?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_meta_tokens_safe: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          instagram_accounts: Json | null
          last_used_at: string | null
          meta_user_id: string | null
          meta_user_name: string | null
          pages: Json | null
          platform: string | null
          scopes: string[] | null
          token_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          instagram_accounts?: Json | null
          last_used_at?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          pages?: Json | null
          platform?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          instagram_accounts?: Json | null
          last_used_at?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          pages?: Json | null
          platform?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          _function_name: string
          _max_requests?: number
          _user_id: string
          _window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_rate_limit_entries: { Args: never; Returns: undefined }
      get_my_rc_status: {
        Args: never
        Returns: {
          is_connected: boolean
          rc_email: string
          token_expires_at: string
        }[]
      }
      get_table_stats: {
        Args: never
        Returns: {
          approx_rows: number
          size_bytes: number
          size_pretty: string
          table_name: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      log_contact_access: {
        Args: {
          _action: string
          _contact_count?: number
          _contact_id?: string
          _metadata?: Json
        }
        Returns: undefined
      }
      log_contact_bulk_access: {
        Args: { _action?: string; _count: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "sales"
        | "accounting"
        | "office"
        | "workshop"
        | "field"
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
      app_role: ["admin", "sales", "accounting", "office", "workshop", "field"],
    },
  },
} as const
