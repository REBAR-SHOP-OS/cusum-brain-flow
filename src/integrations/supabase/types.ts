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
      accounting_mirror_customers: {
        Row: {
          balance: number | null
          company_id: string
          created_at: string
          display_name: string | null
          id: string
          last_synced_at: string | null
          open_balance: number | null
          qb_customer_id: string | null
          total_revenue: number | null
          updated_at: string
        }
        Insert: {
          balance?: number | null
          company_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_synced_at?: string | null
          open_balance?: number | null
          qb_customer_id?: string | null
          total_revenue?: number | null
          updated_at?: string
        }
        Update: {
          balance?: number | null
          company_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_synced_at?: string | null
          open_balance?: number | null
          qb_customer_id?: string | null
          total_revenue?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          company_id: string
          created_at: string
          dedupe_key: string | null
          description: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          inputs_snapshot: Json | null
          metadata: Json | null
          processed_at: string | null
          source: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          company_id: string
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          inputs_snapshot?: Json | null
          metadata?: Json | null
          processed_at?: string | null
          source?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          company_id?: string
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          inputs_snapshot?: Json | null
          metadata?: Json | null
          processed_at?: string | null
          source?: string
        }
        Relationships: []
      }
      agent_action_log: {
        Row: {
          action_type: string
          agent_id: string | null
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json | null
          result: Json | null
          user_id: string
        }
        Insert: {
          action_type: string
          agent_id?: string | null
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          user_id: string
        }
        Update: {
          action_type?: string
          agent_id?: string | null
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          code: string
          created_at: string
          default_role: string
          enabled: boolean
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          default_role: string
          enabled?: boolean
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          default_role?: string
          enabled?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      alert_dispatch_log: {
        Row: {
          channel: string
          company_id: string
          delivered_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          notification_id: string | null
          recipient_address: string
          recipient_user_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          channel: string
          company_id: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_id?: string | null
          recipient_address?: string
          recipient_user_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          company_id?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_id?: string | null
          recipient_address?: string
          recipient_user_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_dispatch_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_escalation_queue: {
        Row: {
          acknowledged_at: string | null
          company_id: string
          created_at: string
          escalate_at: string
          escalation_level: number
          id: string
          notification_id: string
          resolved_at: string | null
          rule_id: string
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          company_id: string
          created_at?: string
          escalate_at: string
          escalation_level?: number
          id?: string
          notification_id: string
          resolved_at?: string | null
          rule_id: string
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          company_id?: string
          created_at?: string
          escalate_at?: string
          escalation_level?: number
          id?: string
          notification_id?: string
          resolved_at?: string | null
          rule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_escalation_queue_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_escalation_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_routing_rules: {
        Row: {
          channels: string[]
          company_id: string
          created_at: string
          enabled: boolean
          escalate_after_minutes: number
          escalate_to_ceo_after_minutes: number | null
          escalate_to_role: string | null
          event_category: string
          event_type: string | null
          id: string
          priority: string
          slack_channel: string | null
          target_roles: string[]
          updated_at: string
        }
        Insert: {
          channels?: string[]
          company_id: string
          created_at?: string
          enabled?: boolean
          escalate_after_minutes?: number
          escalate_to_ceo_after_minutes?: number | null
          escalate_to_role?: string | null
          event_category: string
          event_type?: string | null
          id?: string
          priority?: string
          slack_channel?: string | null
          target_roles?: string[]
          updated_at?: string
        }
        Update: {
          channels?: string[]
          company_id?: string
          created_at?: string
          enabled?: boolean
          escalate_after_minutes?: number
          escalate_to_ceo_after_minutes?: number | null
          escalate_to_role?: string | null
          event_category?: string
          event_type?: string | null
          id?: string
          priority?: string
          slack_channel?: string | null
          target_roles?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      autopilot_actions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          requires_approval: boolean
          result: Json | null
          risk_level: string
          rollback_executed: boolean | null
          rollback_metadata: Json | null
          run_id: string
          status: string
          step_order: number
          tool_name: string
          tool_params: Json
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          requires_approval?: boolean
          result?: Json | null
          risk_level?: string
          rollback_executed?: boolean | null
          rollback_metadata?: Json | null
          run_id: string
          status?: string
          step_order?: number
          tool_name: string
          tool_params?: Json
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          requires_approval?: boolean
          result?: Json | null
          risk_level?: string
          rollback_executed?: boolean | null
          rollback_metadata?: Json | null
          run_id?: string
          status?: string
          step_order?: number
          tool_name?: string
          tool_params?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "autopilot_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_protected_models: {
        Row: {
          created_at: string
          id: string
          model: string
          notes: string | null
          risk_level: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          notes?: string | null
          risk_level?: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          notes?: string | null
          risk_level?: string
        }
        Relationships: []
      }
      autopilot_risk_policies: {
        Row: {
          company_id: string | null
          created_at: string
          field: string | null
          id: string
          model: string | null
          notes: string | null
          risk_level: string
          tool_name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          risk_level: string
          tool_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          risk_level?: string
          tool_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      autopilot_runs: {
        Row: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          completed_at: string | null
          context_snapshot: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          error_log: Json | null
          execution_lock_uuid: string | null
          execution_started_at: string | null
          id: string
          metadata: Json | null
          metrics: Json | null
          phase: string
          plan: Json | null
          simulation_result: Json | null
          started_at: string | null
          status: string
          title: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          completed_at?: string | null
          context_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_log?: Json | null
          execution_lock_uuid?: string | null
          execution_started_at?: string | null
          id?: string
          metadata?: Json | null
          metrics?: Json | null
          phase?: string
          plan?: Json | null
          simulation_result?: Json | null
          started_at?: string | null
          status?: string
          title: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          completed_at?: string | null
          context_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_log?: Json | null
          execution_lock_uuid?: string | null
          execution_started_at?: string | null
          id?: string
          metadata?: Json | null
          metrics?: Json | null
          phase?: string
          plan?: Json | null
          simulation_result?: Json | null
          started_at?: string | null
          status?: string
          title?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      backup_restore_logs: {
        Row: {
          action: string
          backup_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          performed_by: string | null
          performed_by_name: string | null
          result: string
        }
        Insert: {
          action: string
          backup_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          result: string
        }
        Update: {
          action?: string
          backup_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_restore_logs_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "system_backups"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_feed_balances: {
        Row: {
          account_id: string
          account_name: string
          bank_balance: number
          company_id: string
          id: string
          last_updated: string | null
          reconciled_through: string | null
          unaccepted_count: number | null
          unreconciled_count: number | null
          updated_by: string | null
        }
        Insert: {
          account_id: string
          account_name: string
          bank_balance: number
          company_id: string
          id?: string
          last_updated?: string | null
          reconciled_through?: string | null
          unaccepted_count?: number | null
          unreconciled_count?: number | null
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string
          bank_balance?: number
          company_id?: string
          id?: string
          last_updated?: string | null
          reconciled_through?: string | null
          unaccepted_count?: number | null
          unreconciled_count?: number | null
          updated_by?: string | null
        }
        Relationships: []
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
      brand_kit: {
        Row: {
          brand_voice: string
          business_name: string
          colors: Json
          created_at: string
          description: string
          id: string
          logo_url: string | null
          media_urls: string[]
          updated_at: string
          user_id: string
          value_prop: string
        }
        Insert: {
          brand_voice?: string
          business_name?: string
          colors?: Json
          created_at?: string
          description?: string
          id?: string
          logo_url?: string | null
          media_urls?: string[]
          updated_at?: string
          user_id: string
          value_prop?: string
        }
        Update: {
          brand_voice?: string
          business_name?: string
          colors?: Json
          created_at?: string
          description?: string
          id?: string
          logo_url?: string | null
          media_urls?: string[]
          updated_at?: string
          user_id?: string
          value_prop?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          account_category: string | null
          apr: number
          aug: number
          company_id: string
          created_at: string
          created_by: string | null
          dec: number
          department: string | null
          feb: number
          fiscal_year: number
          id: string
          jan: number
          jul: number
          jun: number
          mar: number
          may: number
          name: string
          notes: string | null
          nov: number
          oct: number
          period_type: string
          sep: number
          updated_at: string
        }
        Insert: {
          account_category?: string | null
          apr?: number
          aug?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          dec?: number
          department?: string | null
          feb?: number
          fiscal_year?: number
          id?: string
          jan?: number
          jul?: number
          jun?: number
          mar?: number
          may?: number
          name: string
          notes?: string | null
          nov?: number
          oct?: number
          period_type?: string
          sep?: number
          updated_at?: string
        }
        Update: {
          account_category?: string | null
          apr?: number
          aug?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          dec?: number
          department?: string | null
          feb?: number
          fiscal_year?: number
          id?: string
          jan?: number
          jul?: number
          jun?: number
          mar?: number
          may?: number
          name?: string
          notes?: string | null
          nov?: number
          oct?: number
          period_type?: string
          sep?: number
          updated_at?: string
        }
        Relationships: []
      }
      call_tasks: {
        Row: {
          agent_id: string | null
          ai_transcript: Json | null
          attempt_count: number
          company_id: string
          contact_id: string | null
          contact_name: string
          created_at: string
          details: string | null
          id: string
          last_attempt_at: string | null
          lead_id: string | null
          max_attempts: number
          next_attempt_at: string | null
          notes: string | null
          outcome: string | null
          phone: string
          rc_session_id: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          ai_transcript?: Json | null
          attempt_count?: number
          company_id: string
          contact_id?: string | null
          contact_name: string
          created_at?: string
          details?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          notes?: string | null
          outcome?: string | null
          phone: string
          rc_session_id?: string | null
          reason: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          ai_transcript?: Json | null
          attempt_count?: number
          company_id?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          details?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          notes?: string | null
          outcome?: string | null
          phone?: string
          rc_session_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      cca_schedule_items: {
        Row: {
          additions: number
          asset_description: string
          cca_claimed: number
          cca_class: number
          cca_rate: number
          company_id: string
          created_at: string
          dispositions: number
          fiscal_year: number
          id: string
          ucc_closing: number
          ucc_opening: number
          updated_at: string
          use_this_year: boolean
        }
        Insert: {
          additions?: number
          asset_description?: string
          cca_claimed?: number
          cca_class?: number
          cca_rate?: number
          company_id: string
          created_at?: string
          dispositions?: number
          fiscal_year?: number
          id?: string
          ucc_closing?: number
          ucc_opening?: number
          updated_at?: string
          use_this_year?: boolean
        }
        Update: {
          additions?: number
          asset_description?: string
          cca_claimed?: number
          cca_class?: number
          cca_rate?: number
          company_id?: string
          created_at?: string
          dispositions?: number
          fiscal_year?: number
          id?: string
          ucc_closing?: number
          ucc_opening?: number
          updated_at?: string
          use_this_year?: boolean
        }
        Relationships: []
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
      client_performance_memory: {
        Row: {
          avg_delay_rate: number | null
          avg_margin_pct: number | null
          avg_satisfaction: number | null
          client_lifetime_score: number | null
          company_id: string
          created_at: string
          customer_id: string
          id: string
          last_recalculated_at: string | null
          reorder_rate_pct: number | null
          total_lost_leads: number
          total_revenue: number
          total_won_leads: number
          updated_at: string
          win_rate_pct: number | null
        }
        Insert: {
          avg_delay_rate?: number | null
          avg_margin_pct?: number | null
          avg_satisfaction?: number | null
          client_lifetime_score?: number | null
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          last_recalculated_at?: string | null
          reorder_rate_pct?: number | null
          total_lost_leads?: number
          total_revenue?: number
          total_won_leads?: number
          updated_at?: string
          win_rate_pct?: number | null
        }
        Update: {
          avg_delay_rate?: number | null
          avg_margin_pct?: number | null
          avg_satisfaction?: number | null
          client_lifetime_score?: number | null
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          last_recalculated_at?: string | null
          reorder_rate_pct?: number | null
          total_lost_leads?: number
          total_revenue?: number
          total_won_leads?: number
          updated_at?: string
          win_rate_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_performance_memory_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      code_patches: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          file_path: string
          id: string
          metadata: Json | null
          patch_content: string
          patch_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_system: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          file_path: string
          id?: string
          metadata?: Json | null
          patch_content: string
          patch_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_system?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          file_path?: string
          id?: string
          metadata?: Json | null
          patch_content?: string
          patch_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_system?: string
          updated_at?: string
        }
        Relationships: []
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
      comms_agent_pairing: {
        Row: {
          agent_name: string
          company_id: string
          created_at: string
          draft_only: boolean
          id: string
          rc_extension: string | null
          user_email: string
        }
        Insert: {
          agent_name: string
          company_id?: string
          created_at?: string
          draft_only?: boolean
          id?: string
          rc_extension?: string | null
          user_email: string
        }
        Update: {
          agent_name?: string
          company_id?: string
          created_at?: string
          draft_only?: boolean
          id?: string
          rc_extension?: string | null
          user_email?: string
        }
        Relationships: []
      }
      comms_alerts: {
        Row: {
          alert_type: string
          ceo_notified_at: string | null
          communication_id: string | null
          company_id: string
          created_at: string
          id: string
          metadata: Json | null
          owner_email: string
          owner_notified_at: string | null
          resolved_at: string | null
        }
        Insert: {
          alert_type: string
          ceo_notified_at?: string | null
          communication_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          owner_email: string
          owner_notified_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          alert_type?: string
          ceo_notified_at?: string | null
          communication_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          owner_email?: string
          owner_notified_at?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comms_alerts_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_config: {
        Row: {
          brief_recipients: string[]
          ceo_email: string
          company_id: string
          created_at: string
          daily_brief_time: string
          external_sender: string
          id: string
          internal_domain: string
          internal_sender: string
          missed_call_alert: string
          no_act_global: boolean
          response_thresholds_hours: Json
          updated_at: string
        }
        Insert: {
          brief_recipients?: string[]
          ceo_email?: string
          company_id?: string
          created_at?: string
          daily_brief_time?: string
          external_sender?: string
          id?: string
          internal_domain?: string
          internal_sender?: string
          missed_call_alert?: string
          no_act_global?: boolean
          response_thresholds_hours?: Json
          updated_at?: string
        }
        Update: {
          brief_recipients?: string[]
          ceo_email?: string
          company_id?: string
          created_at?: string
          daily_brief_time?: string
          external_sender?: string
          id?: string
          internal_domain?: string
          internal_sender?: string
          missed_call_alert?: string
          no_act_global?: boolean
          response_thresholds_hours?: Json
          updated_at?: string
        }
        Relationships: []
      }
      communications: {
        Row: {
          ai_action_required: boolean | null
          ai_action_summary: string | null
          ai_category: string | null
          ai_draft: string | null
          ai_priority_data: Json | null
          ai_processed_at: string | null
          ai_urgency: string | null
          body_preview: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          customer_id: string | null
          direction: string | null
          from_address: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          received_at: string | null
          resolved_at: string | null
          resolved_summary: string | null
          source: string
          source_id: string
          status: string | null
          subject: string | null
          thread_id: string | null
          to_address: string | null
          user_id: string | null
        }
        Insert: {
          ai_action_required?: boolean | null
          ai_action_summary?: string | null
          ai_category?: string | null
          ai_draft?: string | null
          ai_priority_data?: Json | null
          ai_processed_at?: string | null
          ai_urgency?: string | null
          body_preview?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          from_address?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          received_at?: string | null
          resolved_at?: string | null
          resolved_summary?: string | null
          source: string
          source_id: string
          status?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          user_id?: string | null
        }
        Update: {
          ai_action_required?: boolean | null
          ai_action_summary?: string | null
          ai_category?: string | null
          ai_draft?: string | null
          ai_priority_data?: Json | null
          ai_processed_at?: string | null
          ai_urgency?: string | null
          body_preview?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          from_address?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          received_at?: string | null
          resolved_at?: string | null
          resolved_summary?: string | null
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
          {
            foreignKeyName: "communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      customer_user_links: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_user_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_province: string | null
          billing_street1: string | null
          billing_street2: string | null
          company_id: string
          company_name: string | null
          created_at: string
          credit_limit: number | null
          customer_type: string | null
          email: string | null
          fax: string | null
          first_name: string | null
          id: string
          last_name: string | null
          middle_name: string | null
          mobile: string | null
          name: string
          notes: string | null
          other_phone: string | null
          payment_terms: string | null
          phone: string | null
          print_on_check_name: string | null
          quickbooks_id: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_province: string | null
          shipping_street1: string | null
          shipping_street2: string | null
          status: string | null
          suffix: string | null
          title: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_province?: string | null
          billing_street1?: string | null
          billing_street2?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: string | null
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          middle_name?: string | null
          mobile?: string | null
          name: string
          notes?: string | null
          other_phone?: string | null
          payment_terms?: string | null
          phone?: string | null
          print_on_check_name?: string | null
          quickbooks_id?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          shipping_street1?: string | null
          shipping_street2?: string | null
          status?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_province?: string | null
          billing_street1?: string | null
          billing_street2?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: string | null
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          middle_name?: string | null
          mobile?: string | null
          name?: string
          notes?: string | null
          other_phone?: string | null
          payment_terms?: string | null
          phone?: string | null
          print_on_check_name?: string | null
          quickbooks_id?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          shipping_street1?: string | null
          shipping_street2?: string | null
          status?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
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
      dedup_rollback_log: {
        Row: {
          created_at: string
          deleted_id: string
          id: string
          post_merge_snapshot: Json | null
          pre_merge_snapshot: Json
          survivor_id: string
        }
        Insert: {
          created_at?: string
          deleted_id: string
          id?: string
          post_merge_snapshot?: Json | null
          pre_merge_snapshot?: Json
          survivor_id: string
        }
        Update: {
          created_at?: string
          deleted_id?: string
          id?: string
          post_merge_snapshot?: Json | null
          pre_merge_snapshot?: Json
          survivor_id?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          company_id: string
          created_at: string
          cut_plan_id: string | null
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
          cut_plan_id?: string | null
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
          cut_plan_id?: string | null
          delivery_number?: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_cut_plan_id_fkey"
            columns: ["cut_plan_id"]
            isOneToOne: false
            referencedRelation: "cut_plans"
            referencedColumns: ["id"]
          },
        ]
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
      email_automations: {
        Row: {
          automation_key: string
          campaign_type: string
          campaigns_generated: number
          company_id: string
          config: Json
          created_at: string
          description: string
          enabled: boolean
          id: string
          last_triggered_at: string | null
          name: string
          priority: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          automation_key: string
          campaign_type?: string
          campaigns_generated?: number
          company_id: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          name: string
          priority?: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          automation_key?: string
          campaign_type?: string
          campaigns_generated?: number
          company_id?: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          name?: string
          priority?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_campaign_sends: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          contact_id: string | null
          created_at: string
          email: string
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body_html: string | null
          body_text: string | null
          campaign_type: string
          company_id: string
          created_at: string
          created_by: string | null
          estimated_recipients: number | null
          id: string
          metadata: Json | null
          preview_text: string | null
          scheduled_at: string | null
          segment_rules: Json | null
          sent_at: string | null
          status: string
          subject_line: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body_html?: string | null
          body_text?: string | null
          campaign_type?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          estimated_recipients?: number | null
          id?: string
          metadata?: Json | null
          preview_text?: string | null
          scheduled_at?: string | null
          segment_rules?: Json | null
          sent_at?: string | null
          status?: string
          subject_line?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body_html?: string | null
          body_text?: string | null
          campaign_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          estimated_recipients?: number | null
          id?: string
          metadata?: Json | null
          preview_text?: string | null
          scheduled_at?: string | null
          segment_rules?: Json | null
          sent_at?: string | null
          status?: string
          subject_line?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      email_consent_events: {
        Row: {
          company_id: string
          consent_type: string
          contact_id: string | null
          email: string
          evidence: Json | null
          id: string
          recorded_at: string
          source: string
          status: string
        }
        Insert: {
          company_id: string
          consent_type?: string
          contact_id?: string | null
          email: string
          evidence?: Json | null
          id?: string
          recorded_at?: string
          source?: string
          status?: string
        }
        Update: {
          company_id?: string
          consent_type?: string
          contact_id?: string | null
          email?: string
          evidence?: Json | null
          id?: string
          recorded_at?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_consent_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_consent_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
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
      email_suppressions: {
        Row: {
          company_id: string
          email: string
          id: string
          processed_at: string | null
          reason: string
          source: string | null
          suppressed_at: string
        }
        Insert: {
          company_id: string
          email: string
          id?: string
          processed_at?: string | null
          reason?: string
          source?: string | null
          suppressed_at?: string
        }
        Update: {
          company_id?: string
          email?: string
          id?: string
          processed_at?: string | null
          reason?: string
          source?: string | null
          suppressed_at?: string
        }
        Relationships: []
      }
      employee_certifications: {
        Row: {
          certificate_number: string | null
          certification_name: string
          company_id: string
          created_at: string
          created_by: string | null
          document_url: string | null
          employee_email: string | null
          employee_name: string
          expiry_date: string | null
          id: string
          issued_date: string | null
          issuing_body: string | null
          notes: string | null
          reminder_days: number | null
          status: string
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          certification_name: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          employee_email?: string | null
          employee_name: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          issuing_body?: string | null
          notes?: string | null
          reminder_days?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          certification_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          employee_email?: string | null
          employee_name?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          issuing_body?: string | null
          notes?: string | null
          reminder_days?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_contracts: {
        Row: {
          company_id: string
          contract_type: string
          created_at: string
          created_by: string | null
          department: string | null
          employee_email: string | null
          employee_name: string
          end_date: string | null
          id: string
          notes: string | null
          notice_period_days: number | null
          pay_frequency: string
          position: string
          probation_end_date: string | null
          salary: number
          salary_currency: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          employee_email?: string | null
          employee_name: string
          end_date?: string | null
          id?: string
          notes?: string | null
          notice_period_days?: number | null
          pay_frequency?: string
          position: string
          probation_end_date?: string | null
          salary?: number
          salary_currency?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          employee_email?: string | null
          employee_name?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          notice_period_days?: number | null
          pay_frequency?: string
          position?: string
          probation_end_date?: string | null
          salary?: number
          salary_currency?: string
          start_date?: string
          status?: string
          updated_at?: string
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
      expense_claim_items: {
        Row: {
          amount: number
          category: string
          claim_id: string
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
        }
        Insert: {
          amount?: number
          category?: string
          claim_id: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          category?: string
          claim_id?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_claim_items_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "expense_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_claims: {
        Row: {
          claim_number: string
          company_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          paid_at: string | null
          payment_reference: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          claim_number: string
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          profile_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          claim_number?: string
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          profile_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
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
          invoice_date: string | null
          invoice_number: string | null
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
          invoice_date?: string | null
          invoice_number?: string | null
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
          invoice_date?: string | null
          invoice_number?: string | null
          manifest_type?: string
          name?: string
          site_address?: string | null
          status?: string
          target_eta?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      face_enrollments: {
        Row: {
          created_at: string
          enrolled_at: string
          id: string
          is_active: boolean
          photo_url: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          enrolled_at?: string
          id?: string
          is_active?: boolean
          photo_url: string
          profile_id: string
        }
        Update: {
          created_at?: string
          enrolled_at?: string
          id?: string
          is_active?: boolean
          photo_url?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_enrollments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_enrollments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      field_audit_trail: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          table_name?: string
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
      fix_tickets: {
        Row: {
          actual_result: string | null
          company_id: string
          created_at: string
          diagnosed_at: string | null
          expected_result: string | null
          fix_output: string | null
          fix_output_type: string | null
          fixed_at: string | null
          id: string
          page_url: string | null
          reporter_email: string | null
          reporter_user_id: string
          repro_steps: string | null
          screenshot_url: string | null
          severity: string
          status: string
          system_area: string | null
          updated_at: string
          verification_evidence: string | null
          verification_result: string | null
          verification_steps: string | null
          verified_at: string | null
        }
        Insert: {
          actual_result?: string | null
          company_id: string
          created_at?: string
          diagnosed_at?: string | null
          expected_result?: string | null
          fix_output?: string | null
          fix_output_type?: string | null
          fixed_at?: string | null
          id?: string
          page_url?: string | null
          reporter_email?: string | null
          reporter_user_id: string
          repro_steps?: string | null
          screenshot_url?: string | null
          severity?: string
          status?: string
          system_area?: string | null
          updated_at?: string
          verification_evidence?: string | null
          verification_result?: string | null
          verification_steps?: string | null
          verified_at?: string | null
        }
        Update: {
          actual_result?: string | null
          company_id?: string
          created_at?: string
          diagnosed_at?: string | null
          expected_result?: string | null
          fix_output?: string | null
          fix_output_type?: string | null
          fixed_at?: string | null
          id?: string
          page_url?: string | null
          reporter_email?: string | null
          reporter_user_id?: string
          repro_steps?: string | null
          screenshot_url?: string | null
          severity?: string
          status?: string
          system_area?: string | null
          updated_at?: string
          verification_evidence?: string | null
          verification_result?: string | null
          verification_steps?: string | null
          verified_at?: string | null
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
      gl_lines: {
        Row: {
          account_id: string | null
          class_id: string | null
          credit: number
          customer_id: string | null
          debit: number
          description: string | null
          gl_transaction_id: string
          id: string
          location_id: string | null
          vendor_id: string | null
        }
        Insert: {
          account_id?: string | null
          class_id?: string | null
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          gl_transaction_id: string
          id?: string
          location_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          account_id?: string | null
          class_id?: string | null
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          gl_transaction_id?: string
          id?: string
          location_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "qb_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "qb_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_lines_gl_transaction_id_fkey"
            columns: ["gl_transaction_id"]
            isOneToOne: false
            referencedRelation: "gl_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "qb_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_transactions: {
        Row: {
          company_id: string
          created_at: string
          currency: string | null
          entity_type: string | null
          id: string
          memo: string | null
          qb_transaction_id: string | null
          source: string
          txn_date: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string | null
          entity_type?: string | null
          id?: string
          memo?: string | null
          qb_transaction_id?: string | null
          source?: string
          txn_date?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string | null
          entity_type?: string | null
          id?: string
          memo?: string | null
          qb_transaction_id?: string | null
          source?: string
          txn_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_transactions_qb_transaction_id_fkey"
            columns: ["qb_transaction_id"]
            isOneToOne: false
            referencedRelation: "qb_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          po_item_id: string
          receipt_id: string
          received_qty: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          po_item_id: string
          receipt_id: string
          received_qty?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          po_item_id?: string
          receipt_id?: string
          received_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string
          receipt_number: string
          received_by: string | null
          received_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          receipt_number: string
          received_by?: string | null
          received_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          receipt_number?: string
          received_by?: string | null
          received_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      human_tasks: {
        Row: {
          actions: Json | null
          agent_id: string | null
          assigned_to: string | null
          category: string | null
          company_id: string
          created_at: string
          dedupe_key: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          impact: string | null
          inputs_snapshot: Json | null
          reason: string | null
          resolved_at: string | null
          severity: string
          snoozed_until: string | null
          source_event_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          agent_id?: string | null
          assigned_to?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          impact?: string | null
          inputs_snapshot?: Json | null
          reason?: string | null
          resolved_at?: string | null
          severity?: string
          snoozed_until?: string | null
          source_event_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          agent_id?: string | null
          assigned_to?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          impact?: string | null
          inputs_snapshot?: Json | null
          reason?: string | null
          resolved_at?: string | null
          severity?: string
          snoozed_until?: string | null
          source_event_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "human_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_tasks_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_tasks_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      inventory_count_lines: {
        Row: {
          bar_code: string
          count_id: string
          counted_qty: number | null
          created_at: string
          expected_qty: number
          id: string
          notes: string | null
          variance: number | null
        }
        Insert: {
          bar_code: string
          count_id: string
          counted_qty?: number | null
          created_at?: string
          expected_qty?: number
          id?: string
          notes?: string | null
          variance?: number | null
        }
        Update: {
          bar_code?: string
          count_id?: string
          counted_qty?: number | null
          created_at?: string
          expected_qty?: number
          id?: string
          notes?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_lines_bar_code_fkey"
            columns: ["bar_code"]
            isOneToOne: false
            referencedRelation: "rebar_sizes"
            referencedColumns: ["bar_code"]
          },
          {
            foreignKeyName: "inventory_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          approved_by: string | null
          company_id: string
          count_date: string
          count_number: string
          count_type: string
          counted_by: string | null
          created_at: string
          id: string
          location: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          company_id: string
          count_date?: string
          count_number: string
          count_type?: string
          counted_by?: string | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          company_id?: string
          count_date?: string
          count_number?: string
          count_type?: string
          counted_by?: string | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
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
      job_applicants: {
        Row: {
          company_id: string
          cover_letter: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          interview_date: string | null
          last_name: string
          notes: string | null
          phone: string | null
          position_id: string
          rating: number | null
          rejection_reason: string | null
          resume_url: string | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          company_id: string
          cover_letter?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          interview_date?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          position_id: string
          rating?: number | null
          rejection_reason?: string | null
          resume_url?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          cover_letter?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          interview_date?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          position_id?: string
          rating?: number | null
          rejection_reason?: string | null
          resume_url?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applicants_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_positions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          employment_type: string
          hiring_manager_id: string | null
          id: string
          location: string | null
          requirements: string | null
          salary_range_max: number | null
          salary_range_min: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          employment_type?: string
          hiring_manager_id?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          employment_type?: string
          hiring_manager_id?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_positions_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_positions_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          category_id: string | null
          company_id: string
          content: string
          created_at: string
          created_by: string | null
          excerpt: string | null
          helpful_no: number | null
          helpful_yes: number | null
          id: string
          is_published: boolean | null
          slug: string
          sort_order: number | null
          title: string
          updated_at: string
          views: number | null
        }
        Insert: {
          category_id?: string | null
          company_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          helpful_no?: number | null
          helpful_yes?: number | null
          id?: string
          is_published?: boolean | null
          slug: string
          sort_order?: number | null
          title: string
          updated_at?: string
          views?: number | null
        }
        Update: {
          category_id?: string | null
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          helpful_no?: number | null
          helpful_yes?: number | null
          id?: string
          is_published?: boolean | null
          slug?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_published: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
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
          odoo_message_id: number | null
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
          odoo_message_id?: number | null
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
          odoo_message_id?: number | null
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
      lead_events: {
        Row: {
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          lead_id: string
          payload: Json | null
          source_system: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          id?: string
          lead_id: string
          payload?: Json | null
          source_system?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          payload?: Json | null
          source_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_files: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_url: string | null
          id: string
          lead_id: string
          mime_type: string | null
          odoo_id: number | null
          source: string | null
          storage_path: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          lead_id: string
          mime_type?: string | null
          odoo_id?: number | null
          source?: string | null
          storage_path?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          lead_id?: string
          mime_type?: string | null
          odoo_id?: number | null
          source?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_loss_memory: {
        Row: {
          captured_at: string
          captured_by: string | null
          company_id: string
          competitor_name: string | null
          created_at: string
          id: string
          lead_id: string
          loss_reason: string
          updated_at: string
          winning_price: number | null
          winning_price_known: boolean
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          company_id: string
          competitor_name?: string | null
          created_at?: string
          id?: string
          lead_id: string
          loss_reason: string
          updated_at?: string
          winning_price?: number | null
          winning_price_known?: boolean
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          company_id?: string
          competitor_name?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          loss_reason?: string
          updated_at?: string
          winning_price?: number | null
          winning_price_known?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lead_loss_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_outcome_memory: {
        Row: {
          actual_margin_pct: number | null
          captured_at: string
          captured_by: string | null
          client_satisfaction: number
          company_id: string
          created_at: string
          customer_id: string | null
          delay_occurred: boolean
          final_cost: number
          final_revenue: number
          id: string
          lead_id: string
          reorder_probability: string
          updated_at: string
        }
        Insert: {
          actual_margin_pct?: number | null
          captured_at?: string
          captured_by?: string | null
          client_satisfaction: number
          company_id: string
          created_at?: string
          customer_id?: string | null
          delay_occurred: boolean
          final_cost: number
          final_revenue: number
          id?: string
          lead_id: string
          reorder_probability: string
          updated_at?: string
        }
        Update: {
          actual_margin_pct?: number | null
          captured_at?: string
          captured_by?: string | null
          client_satisfaction?: number
          company_id?: string
          created_at?: string
          customer_id?: string | null
          delay_occurred?: boolean
          final_cost?: number
          final_revenue?: number
          id?: string
          lead_id?: string
          reorder_probability?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_outcome_memory_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_outcome_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_qualification_memory: {
        Row: {
          budget_known: boolean
          captured_at: string
          captured_by: string | null
          company_id: string
          competitors_involved: boolean
          created_at: string
          deadline: string
          decision_maker_identified: boolean
          estimated_tonnage: number
          id: string
          lead_id: string
          project_type: string
          repeat_customer: boolean
          updated_at: string
        }
        Insert: {
          budget_known: boolean
          captured_at?: string
          captured_by?: string | null
          company_id: string
          competitors_involved: boolean
          created_at?: string
          deadline: string
          decision_maker_identified: boolean
          estimated_tonnage: number
          id?: string
          lead_id: string
          project_type: string
          repeat_customer: boolean
          updated_at?: string
        }
        Update: {
          budget_known?: boolean
          captured_at?: string
          captured_by?: string | null
          company_id?: string
          competitors_involved?: boolean
          created_at?: string
          deadline?: string
          decision_maker_identified?: boolean
          estimated_tonnage?: number
          id?: string
          lead_id?: string
          project_type?: string
          repeat_customer?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualification_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_quote_memory: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_current: boolean
          lead_id: string
          material_cost_snapshot: number
          notes: string | null
          quoted_price: number
          revision_number: number
          strategic_priority: string
          submission_time: string
          submitted_by: string | null
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_current?: boolean
          lead_id: string
          material_cost_snapshot: number
          notes?: string | null
          quoted_price: number
          revision_number?: number
          strategic_priority: string
          submission_time?: string
          submitted_by?: string | null
          target_margin_pct: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_current?: boolean
          lead_id?: string
          material_cost_snapshot?: number
          notes?: string | null
          quoted_price?: number
          revision_number?: number
          strategic_priority?: string
          submission_time?: string
          submitted_by?: string | null
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_quote_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scoring_rules: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          field_name: string
          field_value: string
          id: string
          name: string
          operator: string
          score_points: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          field_name: string
          field_value: string
          id?: string
          name: string
          operator?: string
          score_points?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          field_name?: string
          field_value?: string
          id?: string
          name?: string
          operator?: string
          score_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_id: string
          computed_score: number | null
          contact_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          escalated_to: string | null
          expected_close_date: string | null
          expected_value: number | null
          id: string
          metadata: Json | null
          notes: string | null
          priority: string | null
          priority_score: number | null
          probability: number | null
          quote_id: string | null
          score_confidence: string | null
          score_updated_at: string | null
          sla_breached: boolean
          sla_deadline: string | null
          source: string | null
          source_email_id: string | null
          stage: string
          title: string
          updated_at: string
          win_prob_score: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          computed_score?: number | null
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          escalated_to?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: string | null
          priority_score?: number | null
          probability?: number | null
          quote_id?: string | null
          score_confidence?: string | null
          score_updated_at?: string | null
          sla_breached?: boolean
          sla_deadline?: string | null
          source?: string | null
          source_email_id?: string | null
          stage?: string
          title: string
          updated_at?: string
          win_prob_score?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          computed_score?: number | null
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          escalated_to?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: string | null
          priority_score?: number | null
          probability?: number | null
          quote_id?: string | null
          score_confidence?: string | null
          score_updated_at?: string | null
          sla_breached?: boolean
          sla_deadline?: string | null
          source?: string | null
          source_email_id?: string | null
          stage?: string
          title?: string
          updated_at?: string
          win_prob_score?: number | null
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
      leave_balances: {
        Row: {
          company_id: string
          created_at: string
          id: string
          personal_days_entitled: number
          personal_days_used: number
          profile_id: string
          sick_days_entitled: number
          sick_days_used: number
          updated_at: string
          vacation_days_entitled: number
          vacation_days_used: number
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          personal_days_entitled?: number
          personal_days_used?: number
          profile_id: string
          sick_days_entitled?: number
          sick_days_used?: number
          updated_at?: string
          vacation_days_entitled?: number
          vacation_days_used?: number
          year?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          personal_days_entitled?: number
          personal_days_used?: number
          profile_id?: string
          sick_days_entitled?: number
          sick_days_used?: number
          updated_at?: string
          vacation_days_entitled?: number
          vacation_days_used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_routing: string | null
          assigned_approver_id: string | null
          company_id: string
          created_at: string
          end_date: string
          id: string
          leave_type: string
          profile_id: string
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
        }
        Insert: {
          approval_routing?: string | null
          assigned_approver_id?: string | null
          company_id: string
          created_at?: string
          end_date: string
          id?: string
          leave_type: string
          profile_id: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          total_days?: number
          updated_at?: string
        }
        Update: {
          approval_routing?: string | null
          assigned_approver_id?: string | null
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          profile_id?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_assigned_approver_id_fkey"
            columns: ["assigned_approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_assigned_approver_id_fkey"
            columns: ["assigned_approver_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      loading_checklist: {
        Row: {
          company_id: string
          created_at: string
          cut_plan_id: string
          cut_plan_item_id: string
          id: string
          loaded: boolean
          loaded_at: string | null
          loaded_by: string | null
          photo_path: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          cut_plan_id: string
          cut_plan_item_id: string
          id?: string
          loaded?: boolean
          loaded_at?: string | null
          loaded_by?: string | null
          photo_path?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          cut_plan_id?: string
          cut_plan_item_id?: string
          id?: string
          loaded?: boolean
          loaded_at?: string | null
          loaded_by?: string | null
          photo_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loading_checklist_cut_plan_id_fkey"
            columns: ["cut_plan_id"]
            isOneToOne: false
            referencedRelation: "cut_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_checklist_cut_plan_item_id_fkey"
            columns: ["cut_plan_item_id"]
            isOneToOne: false
            referencedRelation: "cut_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      loading_evidence: {
        Row: {
          captured_by: string | null
          company_id: string | null
          created_at: string | null
          cut_plan_id: string | null
          id: string
          notes: string | null
          photo_url: string
          project_name: string | null
        }
        Insert: {
          captured_by?: string | null
          company_id?: string | null
          created_at?: string | null
          cut_plan_id?: string | null
          id?: string
          notes?: string | null
          photo_url: string
          project_name?: string | null
        }
        Update: {
          captured_by?: string | null
          company_id?: string | null
          created_at?: string | null
          cut_plan_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string
          project_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loading_evidence_cut_plan_id_fkey"
            columns: ["cut_plan_id"]
            isOneToOne: false
            referencedRelation: "cut_plans"
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
      meeting_action_items: {
        Row: {
          assignee_name: string | null
          assignee_profile_id: string | null
          company_id: string | null
          confidence: number | null
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          assignee_name?: string | null
          assignee_profile_id?: string | null
          company_id?: string | null
          confidence?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id: string
          priority?: string
          status?: string
          title: string
        }
        Update: {
          assignee_name?: string | null
          assignee_profile_id?: string | null
          company_id?: string | null
          confidence?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_assignee_profile_id_fkey"
            columns: ["assignee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_assignee_profile_id_fkey"
            columns: ["assignee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_transcript_entries: {
        Row: {
          created_at: string
          id: string
          is_final: boolean
          language: string
          meeting_id: string
          speaker_name: string
          speaker_profile_id: string | null
          text: string
          timestamp_ms: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_final?: boolean
          language?: string
          meeting_id: string
          speaker_name: string
          speaker_profile_id?: string | null
          text: string
          timestamp_ms?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_final?: boolean
          language?: string
          meeting_id?: string
          speaker_name?: string
          speaker_profile_id?: string | null
          text?: string
          timestamp_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcript_entries_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_transcript_entries_speaker_profile_id_fkey"
            columns: ["speaker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_transcript_entries_speaker_profile_id_fkey"
            columns: ["speaker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_logs: {
        Row: {
          created_at: string
          elapsed_s: number
          errors: string[]
          failed: number
          id: string
          migrated: number
          remaining: number
          status: string
        }
        Insert: {
          created_at?: string
          elapsed_s?: number
          errors?: string[]
          failed?: number
          id?: string
          migrated?: number
          remaining?: number
          status?: string
        }
        Update: {
          created_at?: string
          elapsed_s?: number
          errors?: string[]
          failed?: number
          id?: string
          migrated?: number
          remaining?: number
          status?: string
        }
        Relationships: []
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
      optimization_snapshots: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          efficiency: number | null
          id: string
          kerf_mm: number
          min_remnant_mm: number
          mode: string
          plan_data: Json
          session_id: string | null
          stock_length_mm: number
          total_stock_bars: number | null
          total_waste_kg: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          efficiency?: number | null
          id?: string
          kerf_mm?: number
          min_remnant_mm?: number
          mode: string
          plan_data: Json
          session_id?: string | null
          stock_length_mm: number
          total_stock_bars?: number | null
          total_waste_kg?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          efficiency?: number | null
          id?: string
          kerf_mm?: number
          min_remnant_mm?: number
          mode?: string
          plan_data?: Json
          session_id?: string | null
          stock_length_mm?: number
          total_stock_bars?: number | null
          total_waste_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "extract_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          bar_size: string | null
          created_at: string
          description: string
          id: string
          length_mm: number | null
          notes: string | null
          order_id: string
          quantity: number
          shape: string | null
          total_price: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          bar_size?: string | null
          created_at?: string
          description?: string
          id?: string
          length_mm?: number | null
          notes?: string | null
          order_id: string
          quantity?: number
          shape?: string | null
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          bar_size?: string | null
          created_at?: string
          description?: string
          id?: string
          length_mm?: number | null
          notes?: string | null
          order_id?: string
          quantity?: number
          shape?: string | null
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billable_revision_required: boolean
          company_id: string | null
          created_at: string
          customer_approved_at: string | null
          customer_id: string
          customer_revision_count: number
          id: string
          notes: string | null
          order_date: string | null
          order_number: string
          pending_change_order: boolean
          production_locked: boolean
          qc_evidence_uploaded: boolean
          qc_final_approved: boolean
          qc_internal_approved_at: string | null
          quickbooks_invoice_id: string | null
          quote_id: string | null
          required_date: string | null
          shop_drawing_status: string
          status: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          billable_revision_required?: boolean
          company_id?: string | null
          created_at?: string
          customer_approved_at?: string | null
          customer_id: string
          customer_revision_count?: number
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number: string
          pending_change_order?: boolean
          production_locked?: boolean
          qc_evidence_uploaded?: boolean
          qc_final_approved?: boolean
          qc_internal_approved_at?: string | null
          quickbooks_invoice_id?: string | null
          quote_id?: string | null
          required_date?: string | null
          shop_drawing_status?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          billable_revision_required?: boolean
          company_id?: string | null
          created_at?: string
          customer_approved_at?: string | null
          customer_id?: string
          customer_revision_count?: number
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string
          pending_change_order?: boolean
          production_locked?: boolean
          qc_evidence_uploaded?: boolean
          qc_final_approved?: boolean
          qc_internal_approved_at?: string | null
          quickbooks_invoice_id?: string | null
          quote_id?: string | null
          required_date?: string | null
          shop_drawing_status?: string
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
      packing_slips: {
        Row: {
          company_id: string
          created_at: string
          customer_name: string | null
          cut_plan_id: string | null
          delivery_date: string | null
          delivery_id: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          items_json: Json
          scope: string | null
          ship_to: string | null
          signature_path: string | null
          site_address: string | null
          site_photo_path: string | null
          slip_number: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_name?: string | null
          cut_plan_id?: string | null
          delivery_date?: string | null
          delivery_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          items_json?: Json
          scope?: string | null
          ship_to?: string | null
          signature_path?: string | null
          site_address?: string | null
          site_photo_path?: string | null
          slip_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_name?: string | null
          cut_plan_id?: string | null
          delivery_date?: string | null
          delivery_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          items_json?: Json
          scope?: string | null
          ship_to?: string | null
          signature_path?: string | null
          site_address?: string | null
          site_photo_path?: string | null
          slip_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_slips_cut_plan_id_fkey"
            columns: ["cut_plan_id"]
            isOneToOne: false
            referencedRelation: "cut_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_slips_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_audit_log: {
        Row: {
          action: string
          actor_id: string
          after_data: Json | null
          before_data: Json | null
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id: string
          after_data?: Json | null
          before_data?: Json | null
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      payroll_daily_snapshot: {
        Row: {
          ai_notes: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          employee_type: string
          exceptions: Json
          expected_minutes: number
          id: string
          lunch_deducted_minutes: number
          overtime_minutes: number
          paid_break_minutes: number
          paid_minutes: number
          profile_id: string
          raw_clock_in: string | null
          raw_clock_out: string | null
          status: string
          work_date: string
        }
        Insert: {
          ai_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          employee_type?: string
          exceptions?: Json
          expected_minutes?: number
          id?: string
          lunch_deducted_minutes?: number
          overtime_minutes?: number
          paid_break_minutes?: number
          paid_minutes?: number
          profile_id: string
          raw_clock_in?: string | null
          raw_clock_out?: string | null
          status?: string
          work_date: string
        }
        Update: {
          ai_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          employee_type?: string
          exceptions?: Json
          expected_minutes?: number
          id?: string
          lunch_deducted_minutes?: number
          overtime_minutes?: number
          paid_break_minutes?: number
          paid_minutes?: number
          profile_id?: string
          raw_clock_in?: string | null
          raw_clock_out?: string | null
          status?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_daily_snapshot_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_daily_snapshot_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_daily_snapshot_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_daily_snapshot_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_weekly_summary: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          employee_type: string
          id: string
          locked_at: string | null
          overtime_hours: number
          profile_id: string
          regular_hours: number
          status: string
          total_exceptions: number
          total_paid_hours: number
          week_end: string
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          employee_type?: string
          id?: string
          locked_at?: string | null
          overtime_hours?: number
          profile_id: string
          regular_hours?: number
          status?: string
          total_exceptions?: number
          total_paid_hours?: number
          week_end: string
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          employee_type?: string
          id?: string
          locked_at?: string | null
          overtime_hours?: number
          profile_id?: string
          regular_hours?: number
          status?: string
          total_exceptions?: number
          total_paid_hours?: number
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_weekly_summary_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_weekly_summary_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_weekly_summary_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_weekly_summary_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      penny_collection_queue: {
        Row: {
          action_payload: Json | null
          action_type: string
          ai_reasoning: string | null
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          company_id: string
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          days_overdue: number | null
          executed_at: string | null
          execution_result: Json | null
          followup_count: number | null
          followup_date: string | null
          id: string
          invoice_id: string | null
          priority: string
          status: string
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          ai_reasoning?: string | null
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          company_id: string
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          days_overdue?: number | null
          executed_at?: string | null
          execution_result?: Json | null
          followup_count?: number | null
          followup_date?: string | null
          id?: string
          invoice_id?: string | null
          priority?: string
          status?: string
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          ai_reasoning?: string | null
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          days_overdue?: number | null
          executed_at?: string | null
          execution_result?: Json | null
          followup_count?: number | null
          followup_date?: string | null
          id?: string
          invoice_id?: string | null
          priority?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "penny_collection_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penny_collection_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
      pipeline_ai_actions: {
        Row: {
          action_type: string
          ai_reasoning: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          priority: string
          status: string
          suggested_data: Json | null
          updated_at: string
        }
        Insert: {
          action_type: string
          ai_reasoning?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          priority?: string
          status?: string
          suggested_data?: Json | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          ai_reasoning?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          priority?: string
          status?: string
          suggested_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_ai_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stage_order: {
        Row: {
          company_id: string
          id: string
          stage_order: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id?: string
          id?: string
          stage_order?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          stage_order?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pipeline_transition_log: {
        Row: {
          block_reason_code: string | null
          block_reason_detail: Json | null
          company_id: string
          created_at: string
          from_stage: string | null
          id: string
          lead_id: string
          to_stage: string
          transition_result: string
          triggered_by: string
          user_id: string | null
        }
        Insert: {
          block_reason_code?: string | null
          block_reason_detail?: Json | null
          company_id: string
          created_at?: string
          from_stage?: string | null
          id?: string
          lead_id: string
          to_stage: string
          transition_result: string
          triggered_by: string
          user_id?: string | null
        }
        Update: {
          block_reason_code?: string | null
          block_reason_detail?: Json | null
          company_id?: string
          created_at?: string
          from_stage?: string | null
          id?: string
          lead_id?: string
          to_stage?: string
          transition_result?: string
          triggered_by?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_transition_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
          employee_type: string | null
          full_name: string
          id: string
          is_active: boolean | null
          manager_id: string | null
          phone: string | null
          phone_number: string | null
          preferred_language: string
          preferred_voice_id: string | null
          title: string | null
          updated_at: string
          user_id: string | null
          voice_enabled: boolean
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          duties?: string[] | null
          email?: string | null
          employee_type?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          phone?: string | null
          phone_number?: string | null
          preferred_language?: string
          preferred_voice_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          voice_enabled?: boolean
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          duties?: string[] | null
          email?: string | null
          employee_type?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          phone?: string | null
          phone_number?: string | null
          preferred_language?: string
          preferred_voice_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      project_events: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          project_id: string | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          project_id: string
          status: string
          target_date: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          status?: string
          target_date: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          status?: string
          target_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          parent_task_id: string | null
          priority: string
          project_id: string | null
          sort_order: number | null
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          sort_order?: number | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          sort_order?: number | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      prospect_batches: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          prospect_count: number
          region: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          prospect_count?: number
          region?: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          prospect_count?: number
          region?: string
          status?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          batch_id: string
          city: string | null
          company_id: string
          company_name: string
          contact_name: string
          contact_title: string | null
          created_at: string
          email: string | null
          estimated_value: number | null
          fit_reason: string | null
          id: string
          industry: string | null
          intro_angle: string | null
          lead_id: string | null
          phone: string | null
          status: string
        }
        Insert: {
          batch_id: string
          city?: string | null
          company_id: string
          company_name: string
          contact_name: string
          contact_title?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          fit_reason?: string | null
          id?: string
          industry?: string | null
          intro_angle?: string | null
          lead_id?: string | null
          phone?: string | null
          status?: string
        }
        Update: {
          batch_id?: string
          city?: string | null
          company_id?: string
          company_name?: string
          contact_name?: string
          contact_title?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          fit_reason?: string | null
          id?: string
          industry?: string | null
          intro_angle?: string | null
          lead_id?: string | null
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "prospect_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          billed_qty: number
          created_at: string
          description: string
          id: string
          purchase_order_id: string
          quantity: number
          received_qty: number
          total: number | null
          unit_price: number
        }
        Insert: {
          billed_qty?: number
          created_at?: string
          description?: string
          id?: string
          purchase_order_id: string
          quantity?: number
          received_qty?: number
          total?: number | null
          unit_price?: number
        }
        Update: {
          billed_qty?: number
          created_at?: string
          description?: string
          id?: string
          purchase_order_id?: string
          quantity?: number
          received_qty?: number
          total?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      qb_accounts: {
        Row: {
          account_sub_type: string | null
          account_type: string | null
          company_id: string
          created_at: string
          current_balance: number | null
          id: string
          is_active: boolean | null
          is_deleted: boolean | null
          last_synced_at: string | null
          name: string | null
          qb_id: string
          qb_realm_id: string
          raw_json: Json
          sync_token: string | null
          updated_at: string
        }
        Insert: {
          account_sub_type?: string | null
          account_type?: string | null
          company_id: string
          created_at?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          name?: string | null
          qb_id: string
          qb_realm_id: string
          raw_json?: Json
          sync_token?: string | null
          updated_at?: string
        }
        Update: {
          account_sub_type?: string | null
          account_type?: string | null
          company_id?: string
          created_at?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          name?: string | null
          qb_id?: string
          qb_realm_id?: string
          raw_json?: Json
          sync_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qb_bank_activity: {
        Row: {
          account_name: string
          bank_balance: number | null
          company_id: string
          created_at: string
          id: string
          last_qb_sync_at: string | null
          ledger_balance: number
          qb_account_id: string
          reconciled_through_date: string | null
          unaccepted_count: number
          unreconciled_count: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_name: string
          bank_balance?: number | null
          company_id: string
          created_at?: string
          id?: string
          last_qb_sync_at?: string | null
          ledger_balance?: number
          qb_account_id: string
          reconciled_through_date?: string | null
          unaccepted_count?: number
          unreconciled_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_name?: string
          bank_balance?: number | null
          company_id?: string
          created_at?: string
          id?: string
          last_qb_sync_at?: string | null
          ledger_balance?: number
          qb_account_id?: string
          reconciled_through_date?: string | null
          unaccepted_count?: number
          unreconciled_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qb_company_info: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_synced_at: string | null
          qb_realm_id: string
          raw_json: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          qb_realm_id: string
          raw_json?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          qb_realm_id?: string
          raw_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      qb_customers: {
        Row: {
          balance: number | null
          company_id: string
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean | null
          is_deleted: boolean | null
          last_synced_at: string | null
          qb_id: string
          qb_realm_id: string
          raw_json: Json
          sync_token: string | null
          updated_at: string
        }
        Insert: {
          balance?: number | null
          company_id: string
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          qb_id: string
          qb_realm_id: string
          raw_json?: Json
          sync_token?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          qb_id?: string
          qb_realm_id?: string
          raw_json?: Json
          sync_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qb_items: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_deleted: boolean | null
          last_synced_at: string | null
          name: string | null
          qb_id: string
          qb_realm_id: string
          raw_json: Json
          sync_token: string | null
          type: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          name?: string | null
          qb_id: string
          qb_realm_id: string
          raw_json?: Json
          sync_token?: string | null
          type?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          name?: string | null
          qb_id?: string
          qb_realm_id?: string
          raw_json?: Json
          sync_token?: string | null
          type?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      qb_sync_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          duration_ms: number | null
          entity_type: string | null
          error_count: number | null
          errors: string[] | null
          id: string
          qb_ids_processed: string[] | null
          synced_count: number | null
          trial_balance_diff: number | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          duration_ms?: number | null
          entity_type?: string | null
          error_count?: number | null
          errors?: string[] | null
          id?: string
          qb_ids_processed?: string[] | null
          synced_count?: number | null
          trial_balance_diff?: number | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          duration_ms?: number | null
          entity_type?: string | null
          error_count?: number | null
          errors?: string[] | null
          id?: string
          qb_ids_processed?: string[] | null
          synced_count?: number | null
          trial_balance_diff?: number | null
        }
        Relationships: []
      }
      qb_transactions: {
        Row: {
          balance: number | null
          company_id: string
          created_at: string
          customer_qb_id: string | null
          doc_number: string | null
          entity_type: string
          id: string
          is_deleted: boolean | null
          is_voided: boolean | null
          last_synced_at: string | null
          qb_id: string
          qb_realm_id: string
          raw_json: Json
          sync_token: string | null
          total_amt: number | null
          txn_date: string | null
          updated_at: string
          vendor_qb_id: string | null
        }
        Insert: {
          balance?: number | null
          company_id: string
          created_at?: string
          customer_qb_id?: string | null
          doc_number?: string | null
          entity_type: string
          id?: string
          is_deleted?: boolean | null
          is_voided?: boolean | null
          last_synced_at?: string | null
          qb_id: string
          qb_realm_id: string
          raw_json?: Json
          sync_token?: string | null
          total_amt?: number | null
          txn_date?: string | null
          updated_at?: string
          vendor_qb_id?: string | null
        }
        Update: {
          balance?: number | null
          company_id?: string
          created_at?: string
          customer_qb_id?: string | null
          doc_number?: string | null
          entity_type?: string
          id?: string
          is_deleted?: boolean | null
          is_voided?: boolean | null
          last_synced_at?: string | null
          qb_id?: string
          qb_realm_id?: string
          raw_json?: Json
          sync_token?: string | null
          total_amt?: number | null
          txn_date?: string | null
          updated_at?: string
          vendor_qb_id?: string | null
        }
        Relationships: []
      }
      qb_vendors: {
        Row: {
          balance: number | null
          company_id: string
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean | null
          is_deleted: boolean | null
          last_synced_at: string | null
          qb_id: string
          qb_realm_id: string
          raw_json: Json
          sync_token: string | null
          updated_at: string
        }
        Insert: {
          balance?: number | null
          company_id: string
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          qb_id: string
          qb_realm_id: string
          raw_json?: Json
          sync_token?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          qb_id?: string
          qb_realm_id?: string
          raw_json?: Json
          sync_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          chat_transcript: Json | null
          company_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          items: Json | null
          notes: string | null
          project_name: string | null
          quote_number: string
          source: string
          status: string
        }
        Insert: {
          chat_transcript?: Json | null
          company_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          project_name?: string | null
          quote_number: string
          source?: string
          status?: string
        }
        Update: {
          chat_transcript?: Json | null
          company_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          project_name?: string | null
          quote_number?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      quote_template_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_optional: boolean
          notes: string | null
          quantity: number
          sort_order: number
          template_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_optional?: boolean
          notes?: string | null
          quantity?: number
          sort_order?: number
          template_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_optional?: boolean
          notes?: string | null
          quantity?: number
          sort_order?: number
          template_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_type: string | null
          default_tax_rate: number
          default_valid_days: number
          description: string | null
          exclusions: string[] | null
          id: string
          inclusions: string[] | null
          is_active: boolean
          name: string
          notes: string | null
          terms: string[] | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          default_tax_rate?: number
          default_valid_days?: number
          description?: string | null
          exclusions?: string[] | null
          id?: string
          inclusions?: string[] | null
          is_active?: boolean
          name: string
          notes?: string | null
          terms?: string[] | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          default_tax_rate?: number
          default_valid_days?: number
          description?: string | null
          exclusions?: string[] | null
          id?: string
          inclusions?: string[] | null
          is_active?: boolean
          name?: string
          notes?: string | null
          terms?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          margin_percent: number | null
          metadata: Json | null
          notes: string | null
          odoo_id: number | null
          odoo_status: string | null
          quote_number: string
          salesperson: string | null
          signature_data: string | null
          signature_ip: string | null
          signed_at: string | null
          signed_by: string | null
          source: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          margin_percent?: number | null
          metadata?: Json | null
          notes?: string | null
          odoo_id?: number | null
          odoo_status?: string | null
          quote_number: string
          salesperson?: string | null
          signature_data?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          signed_by?: string | null
          source?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          margin_percent?: number | null
          metadata?: Json | null
          notes?: string | null
          odoo_id?: number | null
          odoo_status?: string | null
          quote_number?: string
          salesperson?: string | null
          signature_data?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          signed_by?: string | null
          source?: string | null
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
      reconciliation_matches: {
        Row: {
          bank_account_id: string
          bank_txn_amount: number
          bank_txn_date: string
          bank_txn_description: string | null
          company_id: string
          confidence: number
          created_at: string
          id: string
          match_reason: string | null
          matched_entity_id: string | null
          matched_entity_type: string | null
          matched_mirror_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          bank_txn_amount: number
          bank_txn_date: string
          bank_txn_description?: string | null
          company_id: string
          confidence?: number
          created_at?: string
          id?: string
          match_reason?: string | null
          matched_entity_id?: string | null
          matched_entity_type?: string | null
          matched_mirror_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          bank_txn_amount?: number
          bank_txn_date?: string
          bank_txn_description?: string | null
          company_id?: string
          confidence?: number
          created_at?: string
          id?: string
          match_reason?: string | null
          matched_entity_id?: string | null
          matched_entity_type?: string | null
          matched_mirror_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_matches_matched_mirror_id_fkey"
            columns: ["matched_mirror_id"]
            isOneToOne: false
            referencedRelation: "accounting_mirror"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          created_count: number
          duplicate_count: number
          id: string
          missing_count: number
          out_of_sync_count: number
          results: Json
          run_at: string
          updated_count: number
          window_days: number
        }
        Insert: {
          created_count?: number
          duplicate_count?: number
          id?: string
          missing_count?: number
          out_of_sync_count?: number
          results?: Json
          run_at?: string
          updated_count?: number
          window_days?: number
        }
        Update: {
          created_count?: number
          duplicate_count?: number
          id?: string
          missing_count?: number
          out_of_sync_count?: number
          results?: Json
          run_at?: string
          updated_count?: number
          window_days?: number
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          auto_post: boolean
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          enabled: boolean
          frequency: string
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string
          template_data: Json
          transaction_type: string
          updated_at: string
        }
        Insert: {
          auto_post?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at: string
          template_data?: Json
          transaction_type: string
          updated_at?: string
        }
        Update: {
          auto_post?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string
          template_data?: Json
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_history: {
        Row: {
          approved_by: string | null
          contract_id: string
          created_at: string
          effective_date: string
          id: string
          new_salary: number
          previous_salary: number | null
          reason: string | null
        }
        Insert: {
          approved_by?: string | null
          contract_id: string
          created_at?: string
          effective_date: string
          id?: string
          new_salary: number
          previous_salary?: number | null
          reason?: string | null
        }
        Update: {
          approved_by?: string | null
          contract_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          new_salary?: number
          previous_salary?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employee_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_activities: {
        Row: {
          activity_type: string
          assigned_name: string | null
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string
          entity_id: string
          entity_type: string
          id: string
          note: string | null
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          assigned_name?: string | null
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          entity_id: string
          entity_type?: string
          id?: string
          note?: string | null
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          assigned_name?: string | null
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string | null
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          frequency: string
          id: string
          last_report_url: string | null
          last_run_at: string | null
          name: string
          next_run_at: string
          recipients: string[]
          report_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          frequency?: string
          id?: string
          last_report_url?: string | null
          last_run_at?: string | null
          name: string
          next_run_at: string
          recipients?: string[]
          report_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          frequency?: string
          id?: string
          last_report_url?: string | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string
          recipients?: string[]
          report_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_crawl_pages: {
        Row: {
          canonical: string | null
          company_id: string
          crawl_run_id: string
          created_at: string
          h1: string | null
          id: string
          in_sitemap: boolean | null
          issues_json: Json | null
          load_time_ms: number | null
          meta_description: string | null
          redirect_target: string | null
          robots_directives: string | null
          status_code: number | null
          title: string | null
          url: string
          word_count: number | null
        }
        Insert: {
          canonical?: string | null
          company_id?: string
          crawl_run_id: string
          created_at?: string
          h1?: string | null
          id?: string
          in_sitemap?: boolean | null
          issues_json?: Json | null
          load_time_ms?: number | null
          meta_description?: string | null
          redirect_target?: string | null
          robots_directives?: string | null
          status_code?: number | null
          title?: string | null
          url: string
          word_count?: number | null
        }
        Update: {
          canonical?: string | null
          company_id?: string
          crawl_run_id?: string
          created_at?: string
          h1?: string | null
          id?: string
          in_sitemap?: boolean | null
          issues_json?: Json | null
          load_time_ms?: number | null
          meta_description?: string | null
          redirect_target?: string | null
          robots_directives?: string | null
          status_code?: number | null
          title?: string | null
          url?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_crawl_pages_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "seo_crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_crawl_runs: {
        Row: {
          company_id: string
          completed_at: string | null
          domain_id: string
          health_score: number | null
          id: string
          issues_critical: number | null
          issues_info: number | null
          issues_warning: number | null
          pages_crawled: number | null
          started_at: string
          status: string
        }
        Insert: {
          company_id?: string
          completed_at?: string | null
          domain_id: string
          health_score?: number | null
          id?: string
          issues_critical?: number | null
          issues_info?: number | null
          issues_warning?: number | null
          pages_crawled?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          domain_id?: string
          health_score?: number | null
          id?: string
          issues_critical?: number | null
          issues_info?: number | null
          issues_warning?: number | null
          pages_crawled?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_crawl_runs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_domains: {
        Row: {
          avg_position: number | null
          avg_visit_duration_seconds: number | null
          bounce_rate: number | null
          company_id: string
          created_at: string
          domain: string
          estimated_traffic_pct: number | null
          ga_property_id: string | null
          gsc_verified: boolean
          id: string
          pages_per_visit: number | null
          position_tracking_date: string | null
          top10_keywords: number | null
          top3_keywords: number | null
          total_tracked_keywords: number | null
          traffic_snapshot_month: string | null
          unique_visitors_monthly: number | null
          updated_at: string
          verified_ga: boolean
          visibility_pct: number | null
          visitors_change_pct: number | null
          visits_change_pct: number | null
          visits_monthly: number | null
        }
        Insert: {
          avg_position?: number | null
          avg_visit_duration_seconds?: number | null
          bounce_rate?: number | null
          company_id?: string
          created_at?: string
          domain: string
          estimated_traffic_pct?: number | null
          ga_property_id?: string | null
          gsc_verified?: boolean
          id?: string
          pages_per_visit?: number | null
          position_tracking_date?: string | null
          top10_keywords?: number | null
          top3_keywords?: number | null
          total_tracked_keywords?: number | null
          traffic_snapshot_month?: string | null
          unique_visitors_monthly?: number | null
          updated_at?: string
          verified_ga?: boolean
          visibility_pct?: number | null
          visitors_change_pct?: number | null
          visits_change_pct?: number | null
          visits_monthly?: number | null
        }
        Update: {
          avg_position?: number | null
          avg_visit_duration_seconds?: number | null
          bounce_rate?: number | null
          company_id?: string
          created_at?: string
          domain?: string
          estimated_traffic_pct?: number | null
          ga_property_id?: string | null
          gsc_verified?: boolean
          id?: string
          pages_per_visit?: number | null
          position_tracking_date?: string | null
          top10_keywords?: number | null
          top3_keywords?: number | null
          total_tracked_keywords?: number | null
          traffic_snapshot_month?: string | null
          unique_visitors_monthly?: number | null
          updated_at?: string
          verified_ga?: boolean
          visibility_pct?: number | null
          visitors_change_pct?: number | null
          visits_change_pct?: number | null
          visits_monthly?: number | null
        }
        Relationships: []
      }
      seo_insight: {
        Row: {
          ai_payload_json: Json | null
          company_id: string
          confidence_score: number | null
          created_at: string
          domain_id: string
          entity_id: string | null
          entity_type: string
          explanation_text: string
          id: string
          insight_type: string
        }
        Insert: {
          ai_payload_json?: Json | null
          company_id: string
          confidence_score?: number | null
          created_at?: string
          domain_id: string
          entity_id?: string | null
          entity_type: string
          explanation_text: string
          id?: string
          insight_type: string
        }
        Update: {
          ai_payload_json?: Json | null
          company_id?: string
          confidence_score?: number | null
          created_at?: string
          domain_id?: string
          entity_id?: string | null
          entity_type?: string
          explanation_text?: string
          id?: string
          insight_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_insight_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_issues: {
        Row: {
          company_id: string
          crawl_run_id: string
          created_at: string
          description: string | null
          id: string
          issue_type: string
          page_id: string | null
          page_url: string | null
          severity: string
          title: string
        }
        Insert: {
          company_id?: string
          crawl_run_id: string
          created_at?: string
          description?: string | null
          id?: string
          issue_type: string
          page_id?: string | null
          page_url?: string | null
          severity?: string
          title: string
        }
        Update: {
          company_id?: string
          crawl_run_id?: string
          created_at?: string
          description?: string | null
          id?: string
          issue_type?: string
          page_id?: string | null
          page_url?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_issues_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "seo_crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_issues_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_crawl_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keyword_ai: {
        Row: {
          avg_position: number | null
          business_relevance: number | null
          clicks_28d: number | null
          company_id: string
          created_at: string
          ctr: number | null
          domain_id: string
          harvested_at: string | null
          id: string
          impressions_28d: number | null
          intent: string | null
          keyword: string
          last_analyzed_at: string | null
          opportunity_score: number | null
          sample_context: string | null
          source_count: number | null
          sources: string[] | null
          status: string | null
          top_page: string | null
          topic_cluster: string | null
          trend_score: number | null
        }
        Insert: {
          avg_position?: number | null
          business_relevance?: number | null
          clicks_28d?: number | null
          company_id: string
          created_at?: string
          ctr?: number | null
          domain_id: string
          harvested_at?: string | null
          id?: string
          impressions_28d?: number | null
          intent?: string | null
          keyword: string
          last_analyzed_at?: string | null
          opportunity_score?: number | null
          sample_context?: string | null
          source_count?: number | null
          sources?: string[] | null
          status?: string | null
          top_page?: string | null
          topic_cluster?: string | null
          trend_score?: number | null
        }
        Update: {
          avg_position?: number | null
          business_relevance?: number | null
          clicks_28d?: number | null
          company_id?: string
          created_at?: string
          ctr?: number | null
          domain_id?: string
          harvested_at?: string | null
          id?: string
          impressions_28d?: number | null
          intent?: string | null
          keyword?: string
          last_analyzed_at?: string | null
          opportunity_score?: number | null
          sample_context?: string | null
          source_count?: number | null
          sources?: string[] | null
          status?: string | null
          top_page?: string | null
          topic_cluster?: string | null
          trend_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_keyword_ai_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keywords: {
        Row: {
          active: boolean
          company_id: string
          country: string
          created_at: string
          device: string
          domain_id: string
          id: string
          intent: string | null
          keyword: string
          tags: string[] | null
          target_url: string | null
        }
        Insert: {
          active?: boolean
          company_id?: string
          country?: string
          created_at?: string
          device?: string
          domain_id: string
          id?: string
          intent?: string | null
          keyword: string
          tags?: string[] | null
          target_url?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          country?: string
          created_at?: string
          device?: string
          domain_id?: string
          id?: string
          intent?: string | null
          keyword?: string
          tags?: string[] | null
          target_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_keywords_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_link_audit: {
        Row: {
          anchor_text: string | null
          company_id: string
          created_at: string
          domain_id: string | null
          id: string
          is_fixed: boolean
          link_href: string | null
          link_type: string
          page_url: string
          status: string
          suggested_anchor: string | null
          suggested_href: string | null
          suggestion: string | null
        }
        Insert: {
          anchor_text?: string | null
          company_id: string
          created_at?: string
          domain_id?: string | null
          id?: string
          is_fixed?: boolean
          link_href?: string | null
          link_type?: string
          page_url: string
          status?: string
          suggested_anchor?: string | null
          suggested_href?: string | null
          suggestion?: string | null
        }
        Update: {
          anchor_text?: string | null
          company_id?: string
          created_at?: string
          domain_id?: string | null
          id?: string
          is_fixed?: boolean
          link_href?: string | null
          link_type?: string
          page_url?: string
          status?: string
          suggested_anchor?: string | null
          suggested_href?: string | null
          suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_link_audit_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_page_ai: {
        Row: {
          ai_recommendations: Json | null
          avg_position: number | null
          clicks: number | null
          company_id: string
          conversions: number | null
          created_at: string
          ctr: number | null
          cwv_status: string | null
          domain_id: string
          engagement_rate: number | null
          id: string
          impressions: number | null
          issues_json: Json | null
          last_analyzed_at: string | null
          revenue: number | null
          seo_score: number | null
          sessions: number | null
          speed_score: number | null
          url: string
        }
        Insert: {
          ai_recommendations?: Json | null
          avg_position?: number | null
          clicks?: number | null
          company_id: string
          conversions?: number | null
          created_at?: string
          ctr?: number | null
          cwv_status?: string | null
          domain_id: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          issues_json?: Json | null
          last_analyzed_at?: string | null
          revenue?: number | null
          seo_score?: number | null
          sessions?: number | null
          speed_score?: number | null
          url: string
        }
        Update: {
          ai_recommendations?: Json | null
          avg_position?: number | null
          clicks?: number | null
          company_id?: string
          conversions?: number | null
          created_at?: string
          ctr?: number | null
          cwv_status?: string | null
          domain_id?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          issues_json?: Json | null
          last_analyzed_at?: string | null
          revenue?: number | null
          seo_score?: number | null
          sessions?: number | null
          speed_score?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_ai_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_rank_history: {
        Row: {
          clicks: number | null
          company_id: string
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          keyword_id: string
          position: number | null
          source: string
          url_found: string | null
        }
        Insert: {
          clicks?: number | null
          company_id?: string
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          keyword_id: string
          position?: number | null
          source?: string
          url_found?: string | null
        }
        Update: {
          clicks?: number | null
          company_id?: string
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          keyword_id?: string
          position?: number | null
          source?: string
          url_found?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_rank_history_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "seo_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_tasks: {
        Row: {
          ai_reasoning: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          domain_id: string | null
          entity_type: string | null
          entity_url: string | null
          executed_at: string | null
          executed_by: string | null
          execution_log: Json | null
          expected_impact: string | null
          id: string
          linked_issue_id: string | null
          priority: string
          status: string
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_reasoning?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          domain_id?: string | null
          entity_type?: string | null
          entity_url?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_log?: Json | null
          expected_impact?: string | null
          id?: string
          linked_issue_id?: string | null
          priority?: string
          status?: string
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_reasoning?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          domain_id?: string | null
          entity_type?: string | null
          entity_url?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_log?: Json | null
          expected_impact?: string | null
          id?: string
          linked_issue_id?: string | null
          priority?: string
          status?: string
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_tasks_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seo_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_tasks_linked_issue_id_fkey"
            columns: ["linked_issue_id"]
            isOneToOne: false
            referencedRelation: "seo_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_escalation_log: {
        Row: {
          breached_at: string
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          escalated_to: string
          id: string
          resolved_at: string | null
          sla_hours: number
          stage: string
        }
        Insert: {
          breached_at?: string
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          escalated_to: string
          id?: string
          resolved_at?: string | null
          sla_hours: number
          stage: string
        }
        Update: {
          breached_at?: string
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          escalated_to?: string
          id?: string
          resolved_at?: string | null
          sla_hours?: number
          stage?: string
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
      speed_audit_results: {
        Row: {
          audited_at: string
          cls: number | null
          company_id: string
          fcp_ms: number | null
          id: string
          issues: Json | null
          lcp_ms: number | null
          page_url: string
          performance_score: number | null
          recommendations: Json | null
          ttfb_ms: number | null
        }
        Insert: {
          audited_at?: string
          cls?: number | null
          company_id?: string
          fcp_ms?: number | null
          id?: string
          issues?: Json | null
          lcp_ms?: number | null
          page_url: string
          performance_score?: number | null
          recommendations?: Json | null
          ttfb_ms?: number | null
        }
        Update: {
          audited_at?: string
          cls?: number | null
          company_id?: string
          fcp_ms?: number | null
          id?: string
          issues?: Json | null
          lcp_ms?: number | null
          page_url?: string
          performance_score?: number | null
          recommendations?: Json | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          actions: Json | null
          agent_id: string | null
          category: string
          company_id: string
          context: Json | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          impact: string | null
          priority: number | null
          reason: string | null
          resolved_at: string | null
          severity: string
          shown_at: string | null
          shown_to: string | null
          snoozed_until: string | null
          status: string
          suggestion_type: string
          title: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          agent_id?: string | null
          category: string
          company_id?: string
          context?: Json | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          impact?: string | null
          priority?: number | null
          reason?: string | null
          resolved_at?: string | null
          severity?: string
          shown_at?: string | null
          shown_to?: string | null
          snoozed_until?: string | null
          status?: string
          suggestion_type: string
          title: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          agent_id?: string | null
          category?: string
          company_id?: string
          context?: Json | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          impact?: string | null
          priority?: number | null
          reason?: string | null
          resolved_at?: string | null
          severity?: string
          shown_at?: string | null
          shown_to?: string | null
          snoozed_until?: string | null
          status?: string
          suggestion_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          id: string
          last_message_at: string | null
          metadata: Json | null
          resolved_at: string | null
          status: string
          tags: string[] | null
          updated_at: string
          visitor_email: string | null
          visitor_name: string | null
          visitor_token: string
          widget_config_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          resolved_at?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          visitor_email?: string | null
          visitor_name?: string | null
          visitor_token?: string
          widget_config_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          resolved_at?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          visitor_email?: string | null
          visitor_name?: string | null
          visitor_token?: string
          widget_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_widget_config_id_fkey"
            columns: ["widget_config_id"]
            isOneToOne: false
            referencedRelation: "support_widget_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          content_type: string | null
          conversation_id: string
          created_at: string
          id: string
          is_internal_note: boolean | null
          metadata: Json | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          content: string
          content_type?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: string
        }
        Update: {
          content?: string
          content_type?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_widget_configs: {
        Row: {
          ai_enabled: boolean
          ai_system_prompt: string | null
          allowed_domains: string[] | null
          brand_color: string | null
          brand_name: string | null
          company_id: string
          created_at: string
          enabled: boolean | null
          id: string
          offline_message: string | null
          updated_at: string
          welcome_message: string | null
          widget_key: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_system_prompt?: string | null
          allowed_domains?: string[] | null
          brand_color?: string | null
          brand_name?: string | null
          company_id: string
          created_at?: string
          enabled?: boolean | null
          id?: string
          offline_message?: string | null
          updated_at?: string
          welcome_message?: string | null
          widget_key?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_system_prompt?: string | null
          allowed_domains?: string[] | null
          brand_color?: string | null
          brand_name?: string | null
          company_id?: string
          created_at?: string
          enabled?: boolean | null
          id?: string
          offline_message?: string | null
          updated_at?: string
          welcome_message?: string | null
          widget_key?: string
        }
        Relationships: []
      }
      system_backups: {
        Row: {
          backup_type: string
          company_id: string
          completed_at: string | null
          created_by: string | null
          created_by_name: string | null
          error_message: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          started_at: string | null
          status: string
          tables_backed_up: string[] | null
        }
        Insert: {
          backup_type?: string
          company_id: string
          completed_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string
          tables_backed_up?: string[] | null
        }
        Update: {
          backup_type?: string
          company_id?: string
          completed_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string
          tables_backed_up?: string[] | null
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
      task_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_audit_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          profile_id: string
          task_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          profile_id: string
          task_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_type: string | null
          assigned_to: string | null
          attachment_url: string | null
          attachment_urls: string[] | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by_profile_id: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          resolution_note: string | null
          source: string | null
          source_ref: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_type?: string | null
          assigned_to?: string | null
          attachment_url?: string | null
          attachment_urls?: string[] | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          resolution_note?: string | null
          source?: string | null
          source_ref?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_type?: string | null
          assigned_to?: string | null
          attachment_url?: string | null
          attachment_urls?: string[] | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          resolution_note?: string | null
          source?: string | null
          source_ref?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_deduction_tracker: {
        Row: {
          category: string
          claimed_amount: number
          company_id: string
          created_at: string
          description: string
          estimated_amount: number
          fiscal_year: number
          id: string
          is_claimed: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          claimed_amount?: number
          company_id: string
          created_at?: string
          description?: string
          estimated_amount?: number
          fiscal_year?: number
          id?: string
          is_claimed?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          claimed_amount?: number
          company_id?: string
          created_at?: string
          description?: string
          estimated_amount?: number
          fiscal_year?: number
          id?: string
          is_claimed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tax_planning_profiles: {
        Row: {
          company_id: string
          created_at: string
          fiscal_year: number
          hsa_annual_limit: number
          hsa_claimed_ytd: number
          id: string
          max_withdrawal_pct: number
          notes: string | null
          owner_pay_strategy: string
          personal_bracket_estimate: number
          sbr_rate: number
          target_retained_earnings: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          fiscal_year?: number
          hsa_annual_limit?: number
          hsa_claimed_ytd?: number
          id?: string
          max_withdrawal_pct?: number
          notes?: string | null
          owner_pay_strategy?: string
          personal_bracket_estimate?: number
          sbr_rate?: number
          target_retained_earnings?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          fiscal_year?: number
          hsa_annual_limit?: number
          hsa_claimed_ytd?: number
          id?: string
          max_withdrawal_pct?: number
          notes?: string | null
          owner_pay_strategy?: string
          personal_bracket_estimate?: number
          sbr_rate?: number
          target_retained_earnings?: number
          updated_at?: string
        }
        Relationships: []
      }
      tax_planning_tasks: {
        Row: {
          assigned_to: string | null
          category: string
          company_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          fiscal_year: number
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          fiscal_year?: number
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          fiscal_year?: number
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          is_external: boolean
          meeting_type: string
          notes: string | null
          participants: string[] | null
          recording_url: string | null
          room_code: string
          share_settings: Json
          started_at: string
          started_by: string
          status: string
          structured_report: Json | null
          title: string
          transcript: Json | null
        }
        Insert: {
          ai_summary?: string | null
          channel_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_external?: boolean
          meeting_type?: string
          notes?: string | null
          participants?: string[] | null
          recording_url?: string | null
          room_code: string
          share_settings?: Json
          started_at?: string
          started_by: string
          status?: string
          structured_report?: Json | null
          title?: string
          transcript?: Json | null
        }
        Update: {
          ai_summary?: string | null
          channel_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_external?: boolean
          meeting_type?: string
          notes?: string | null
          participants?: string[] | null
          recording_url?: string | null
          room_code?: string
          share_settings?: Json
          started_at?: string
          started_by?: string
          status?: string
          structured_report?: Json | null
          title?: string
          transcript?: Json | null
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
          attachments: Json | null
          channel_id: string
          created_at: string
          id: string
          original_language: string
          original_text: string
          sender_profile_id: string
          translations: Json
        }
        Insert: {
          attachments?: Json | null
          channel_id: string
          created_at?: string
          id?: string
          original_language?: string
          original_text: string
          sender_profile_id: string
          translations?: Json
        }
        Update: {
          attachments?: Json | null
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
      three_way_matches: {
        Row: {
          auto_matched: boolean | null
          bill_quickbooks_id: string | null
          company_id: string
          created_at: string
          goods_receipt_id: string | null
          id: string
          match_status: string
          notes: string | null
          price_variance: number | null
          purchase_order_id: string
          qty_variance: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          auto_matched?: boolean | null
          bill_quickbooks_id?: string | null
          company_id: string
          created_at?: string
          goods_receipt_id?: string | null
          id?: string
          match_status?: string
          notes?: string | null
          price_variance?: number | null
          purchase_order_id: string
          qty_variance?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          auto_matched?: boolean | null
          bill_quickbooks_id?: string | null
          company_id?: string
          created_at?: string
          goods_receipt_id?: string | null
          id?: string
          match_status?: string
          notes?: string | null
          price_variance?: number | null
          purchase_order_id?: string
          qty_variance?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "three_way_matches_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "three_way_matches_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "three_way_matches_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "three_way_matches_reviewed_by_fkey"
            columns: ["reviewed_by"]
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
      transaction_patterns: {
        Row: {
          action_payload_template: Json
          action_type: string
          auto_suggest: boolean
          company_id: string
          created_at: string
          created_by: string
          customer_qb_id: string | null
          id: string
          times_used: number
          trigger_condition: Json
          updated_at: string
        }
        Insert: {
          action_payload_template?: Json
          action_type: string
          auto_suggest?: boolean
          company_id: string
          created_at?: string
          created_by: string
          customer_qb_id?: string | null
          id?: string
          times_used?: number
          trigger_condition?: Json
          updated_at?: string
        }
        Update: {
          action_payload_template?: Json
          action_type?: string
          auto_suggest?: boolean
          company_id?: string
          created_at?: string
          created_by?: string
          customer_qb_id?: string | null
          id?: string
          times_used?: number
          trigger_condition?: Json
          updated_at?: string
        }
        Relationships: []
      }
      transcription_sessions: {
        Row: {
          company_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          process_type: string | null
          processed_output: string | null
          profile_id: string
          raw_transcript: string
          source_language: string | null
          speaker_count: number | null
          target_language: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          process_type?: string | null
          processed_output?: string | null
          profile_id: string
          raw_transcript?: string
          source_language?: string | null
          speaker_count?: number | null
          target_language?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          process_type?: string | null
          processed_output?: string | null
          profile_id?: string
          raw_transcript?: string
          source_language?: string | null
          speaker_count?: number | null
          target_language?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcription_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_balance_checks: {
        Row: {
          ap_diff: number | null
          ar_diff: number | null
          checked_at: string
          company_id: string
          created_at: string
          details: Json | null
          erp_total: number
          id: string
          is_balanced: boolean
          qb_total: number
          total_diff: number
        }
        Insert: {
          ap_diff?: number | null
          ar_diff?: number | null
          checked_at?: string
          company_id: string
          created_at?: string
          details?: Json | null
          erp_total?: number
          id?: string
          is_balanced?: boolean
          qb_total?: number
          total_diff?: number
        }
        Update: {
          ap_diff?: number | null
          ar_diff?: number | null
          checked_at?: string
          company_id?: string
          created_at?: string
          details?: Json | null
          erp_total?: number
          id?: string
          is_balanced?: boolean
          qb_total?: number
          total_diff?: number
        }
        Relationships: []
      }
      user_agents: {
        Row: {
          agent_id: string
          assigned_at: string
          company_id: string
          id: string
          mode: string
          user_id: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          company_id: string
          id?: string
          mode?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          company_id?: string
          id?: string
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gmail_tokens: {
        Row: {
          created_at: string
          gmail_email: string
          id: string
          is_encrypted: boolean
          last_used_at: string | null
          last_used_ip: string | null
          refresh_token: string
          token_rotated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gmail_email: string
          id?: string
          is_encrypted?: boolean
          last_used_at?: string | null
          last_used_ip?: string | null
          refresh_token: string
          token_rotated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gmail_email?: string
          id?: string
          is_encrypted?: boolean
          last_used_at?: string | null
          last_used_ip?: string | null
          refresh_token?: string
          token_rotated_at?: string | null
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
      vendor_user_links: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_user_links_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ventures: {
        Row: {
          ai_analysis: Json | null
          company_id: string | null
          competitive_notes: string | null
          created_at: string
          created_by: string
          distribution_plan: string | null
          id: string
          linked_lead_id: string | null
          linked_order_ids: string[] | null
          metrics: Json | null
          mvp_scope: string | null
          name: string
          notes: string | null
          odoo_context: Json | null
          phase: string
          problem_statement: string | null
          revenue_model: string | null
          status: string
          target_customer: string | null
          updated_at: string
          value_multiplier: string | null
          vertical: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          company_id?: string | null
          competitive_notes?: string | null
          created_at?: string
          created_by: string
          distribution_plan?: string | null
          id?: string
          linked_lead_id?: string | null
          linked_order_ids?: string[] | null
          metrics?: Json | null
          mvp_scope?: string | null
          name: string
          notes?: string | null
          odoo_context?: Json | null
          phase?: string
          problem_statement?: string | null
          revenue_model?: string | null
          status?: string
          target_customer?: string | null
          updated_at?: string
          value_multiplier?: string | null
          vertical?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          company_id?: string | null
          competitive_notes?: string | null
          created_at?: string
          created_by?: string
          distribution_plan?: string | null
          id?: string
          linked_lead_id?: string | null
          linked_order_ids?: string[] | null
          metrics?: Json | null
          mvp_scope?: string | null
          name?: string
          notes?: string | null
          odoo_context?: Json | null
          phase?: string
          problem_statement?: string | null
          revenue_model?: string | null
          status?: string
          target_customer?: string | null
          updated_at?: string
          value_multiplier?: string | null
          vertical?: string | null
        }
        Relationships: []
      }
      vizzy_fix_requests: {
        Row: {
          affected_area: string | null
          created_at: string
          description: string
          id: string
          photo_url: string | null
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          affected_area?: string | null
          created_at?: string
          description: string
          id?: string
          photo_url?: string | null
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          affected_area?: string | null
          created_at?: string
          description?: string
          id?: string
          photo_url?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      vizzy_interactions: {
        Row: {
          context_snapshot: Json | null
          created_at: string
          id: string
          session_date: string
          session_ended_at: string | null
          session_started_at: string
          transcript: Json
          user_id: string
        }
        Insert: {
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          session_date?: string
          session_ended_at?: string | null
          session_started_at?: string
          transcript?: Json
          user_id: string
        }
        Update: {
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          session_date?: string
          session_ended_at?: string | null
          session_started_at?: string
          transcript?: Json
          user_id?: string
        }
        Relationships: []
      }
      vizzy_journals: {
        Row: {
          content: string
          created_at: string
          id: string
          interaction_count: number
          journal_date: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          interaction_count?: number
          journal_date?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          interaction_count?: number
          journal_date?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      vizzy_memory: {
        Row: {
          category: string
          company_id: string
          content: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          category?: string
          company_id: string
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          category?: string
          company_id?: string
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
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
      wp_change_log: {
        Row: {
          created_at: string
          endpoint: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          method: string
          new_state: Json | null
          previous_state: Json | null
          result: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          method: string
          new_state?: Json | null
          previous_state?: Json | null
          result?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          method?: string
          new_state?: Json | null
          previous_state?: Json | null
          result?: string
          user_id?: string
        }
        Relationships: []
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
      events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          company_id: string | null
          created_at: string | null
          dedupe_key: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string | null
          id: string | null
          inputs_snapshot: Json | null
          metadata: Json | null
          processed_at: string | null
          source: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          company_id?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string | null
          inputs_snapshot?: Json | null
          metadata?: Json | null
          processed_at?: string | null
          source?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          company_id?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string | null
          inputs_snapshot?: Json | null
          metadata?: Json | null
          processed_at?: string | null
          source?: string | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          duties: string[] | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          manager_id: string | null
          preferred_language: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          duties?: string[] | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          manager_id?: string | null
          preferred_language?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          duties?: string[] | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          manager_id?: string | null
          preferred_language?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
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
      accounting_health_customer_debug: {
        Args: { p_company_id: string; p_customer_qb_id: string }
        Returns: {
          invoice_count: number
          invoices: Json
          total_open_balance: number
        }[]
      }
      accounting_health_summary: {
        Args: { p_company_id: string }
        Returns: {
          last_invoice_updated_at: string
          missing_customer_qb_id_count: number
          null_balance_count: number
          open_balance_count: number
          total_invoices: number
        }[]
      }
      accounting_health_top_customers: {
        Args: { p_company_id: string; p_limit?: number }
        Returns: {
          customer_qb_id: string
          open_balance: number
          open_invoice_count: number
        }[]
      }
      acquire_autopilot_lock: {
        Args: { _company_id: string; _lock_uuid: string; _run_id: string }
        Returns: number
      }
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
      create_dm_channel: {
        Args: { _my_profile_id: string; _target_profile_id: string }
        Returns: string
      }
      execute_readonly_query: { Args: { sql_query: string }; Returns: Json }
      execute_write_fix: { Args: { sql_query: string }; Returns: Json }
      get_my_gmail_status: {
        Args: never
        Returns: {
          gmail_email: string
          is_connected: boolean
        }[]
      }
      get_my_rc_status: {
        Args: never
        Returns: {
          is_connected: boolean
          rc_email: string
          token_expires_at: string
        }[]
      }
      get_qb_customer_balances: {
        Args: { p_company_id: string }
        Returns: {
          customer_qb_id: string
          open_balance: number
          open_invoice_count: number
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
      recalculate_client_performance: {
        Args: { p_company_id: string; p_customer_id: string }
        Returns: undefined
      }
      score_lead: { Args: { p_lead_id: string }; Returns: undefined }
      verify_admin_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "sales"
        | "accounting"
        | "office"
        | "workshop"
        | "field"
        | "shop_supervisor"
        | "customer"
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
      app_role: [
        "admin",
        "sales",
        "accounting",
        "office",
        "workshop",
        "field",
        "shop_supervisor",
        "customer",
      ],
    },
  },
} as const
