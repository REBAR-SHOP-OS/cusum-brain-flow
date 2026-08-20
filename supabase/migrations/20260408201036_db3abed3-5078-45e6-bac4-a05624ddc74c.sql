
-- ============================================
-- Fix 5 FKs referencing auth.users directly
-- ============================================
ALTER TABLE public.sales_lead_activities
  DROP CONSTRAINT sales_lead_activities_user_id_fkey,
  ADD CONSTRAINT sales_lead_activities_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.backup_restore_logs
  DROP CONSTRAINT backup_restore_logs_performed_by_fkey,
  ADD CONSTRAINT backup_restore_logs_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.invite_tokens
  DROP CONSTRAINT invite_tokens_created_by_fkey,
  ADD CONSTRAINT invite_tokens_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_automation_rules
  DROP CONSTRAINT pipeline_automation_rules_created_by_fkey,
  ADD CONSTRAINT pipeline_automation_rules_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.system_backups
  DROP CONSTRAINT system_backups_created_by_fkey,
  ADD CONSTRAINT system_backups_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- Fix 26 FKs referencing profiles
-- ============================================
ALTER TABLE public.bid_board
  DROP CONSTRAINT bid_board_estimator_id_fkey,
  ADD CONSTRAINT bid_board_estimator_id_fkey
    FOREIGN KEY (estimator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.deliveries
  DROP CONSTRAINT deliveries_driver_profile_id_fkey,
  ADD CONSTRAINT deliveries_driver_profile_id_fkey
    FOREIGN KEY (driver_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.email_campaigns
  DROP CONSTRAINT email_campaigns_created_by_fkey,
  ADD CONSTRAINT email_campaigns_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.email_campaigns
  DROP CONSTRAINT email_campaigns_approved_by_fkey,
  ADD CONSTRAINT email_campaigns_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.estimation_projects
  DROP CONSTRAINT estimation_projects_estimator_id_fkey,
  ADD CONSTRAINT estimation_projects_estimator_id_fkey
    FOREIGN KEY (estimator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.expense_claims
  DROP CONSTRAINT expense_claims_reviewed_by_fkey,
  ADD CONSTRAINT expense_claims_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.expense_claims
  DROP CONSTRAINT expense_claims_profile_id_fkey,
  ADD CONSTRAINT expense_claims_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.goods_receipts
  DROP CONSTRAINT goods_receipts_received_by_fkey,
  ADD CONSTRAINT goods_receipts_received_by_fkey
    FOREIGN KEY (received_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_positions
  DROP CONSTRAINT job_positions_hiring_manager_id_fkey,
  ADD CONSTRAINT job_positions_hiring_manager_id_fkey
    FOREIGN KEY (hiring_manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT leave_requests_reviewed_by_fkey,
  ADD CONSTRAINT leave_requests_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.machine_runs
  DROP CONSTRAINT machine_runs_operator_profile_id_fkey,
  ADD CONSTRAINT machine_runs_operator_profile_id_fkey
    FOREIGN KEY (operator_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.machine_runs
  DROP CONSTRAINT machine_runs_supervisor_profile_id_fkey,
  ADD CONSTRAINT machine_runs_supervisor_profile_id_fkey
    FOREIGN KEY (supervisor_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.machines
  DROP CONSTRAINT machines_current_operator_profile_id_fkey,
  ADD CONSTRAINT machines_current_operator_profile_id_fkey
    FOREIGN KEY (current_operator_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.meeting_action_items
  DROP CONSTRAINT meeting_action_items_assignee_profile_id_fkey,
  ADD CONSTRAINT meeting_action_items_assignee_profile_id_fkey
    FOREIGN KEY (assignee_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.meeting_transcript_entries
  DROP CONSTRAINT meeting_transcript_entries_speaker_profile_id_fkey,
  ADD CONSTRAINT meeting_transcript_entries_speaker_profile_id_fkey
    FOREIGN KEY (speaker_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT orders_owner_id_fkey,
  ADD CONSTRAINT orders_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.payroll_daily_snapshot
  DROP CONSTRAINT payroll_daily_snapshot_approved_by_fkey,
  ADD CONSTRAINT payroll_daily_snapshot_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.payroll_weekly_summary
  DROP CONSTRAINT payroll_weekly_summary_approved_by_fkey,
  ADD CONSTRAINT payroll_weekly_summary_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.penny_collection_queue
  DROP CONSTRAINT penny_collection_queue_assigned_to_fkey,
  ADD CONSTRAINT penny_collection_queue_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.project_tasks
  DROP CONSTRAINT project_tasks_assigned_to_fkey,
  ADD CONSTRAINT project_tasks_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.support_conversations
  DROP CONSTRAINT support_conversations_assigned_to_fkey,
  ADD CONSTRAINT support_conversations_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.task_comments
  DROP CONSTRAINT task_comments_profile_id_fkey,
  ADD CONSTRAINT task_comments_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT tasks_created_by_profile_id_fkey,
  ADD CONSTRAINT tasks_created_by_profile_id_fkey
    FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.team_messages
  DROP CONSTRAINT team_messages_sender_profile_id_fkey,
  ADD CONSTRAINT team_messages_sender_profile_id_fkey
    FOREIGN KEY (sender_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.three_way_matches
  DROP CONSTRAINT three_way_matches_reviewed_by_fkey,
  ADD CONSTRAINT three_way_matches_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.transcription_sessions
  DROP CONSTRAINT transcription_sessions_profile_id_fkey,
  ADD CONSTRAINT transcription_sessions_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
