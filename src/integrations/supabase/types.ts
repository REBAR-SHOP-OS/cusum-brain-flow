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
      communications: {
        Row: {
          body_preview: string | null
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
            foreignKeyName: "communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
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
      customers: {
        Row: {
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
      deliveries: {
        Row: {
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
      employee_salaries: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          salary_amount: number
          salary_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          salary_amount: number
          salary_type?: string
          updated_at?: string
        }
        Update: {
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
      knowledge: {
        Row: {
          category: string
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
      leads: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          expected_close_date: string | null
          expected_value: number | null
          id: string
          notes: string | null
          priority: string | null
          probability: number | null
          quote_id: string | null
          source: string | null
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          probability?: number | null
          quote_id?: string | null
          source?: string | null
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          probability?: number | null
          quote_id?: string | null
          source?: string | null
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
            foreignKeyName: "machine_runs_supervisor_profile_id_fkey"
            columns: ["supervisor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          link_to: string | null
          metadata: Json | null
          priority: string | null
          status: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_color?: string | null
          agent_name?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          link_to?: string | null
          metadata?: Json | null
          priority?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_color?: string | null
          agent_name?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          link_to?: string | null
          metadata?: Json | null
          priority?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
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
          title?: string | null
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          content: string
          created_at: string
          hashtags: string[] | null
          id: string
          image_url: string | null
          platform: string
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          platform: string
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          platform?: string
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agent_type: string | null
          assigned_to: string | null
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
          created_at: string
          id: string
          notes: string | null
          order_id: string
          priority: number | null
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
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          priority?: number | null
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
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          priority?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string | null
          updated_at?: string
          work_order_number?: string
          workstation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      [_ in never]: never
    }
    Functions: {
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
