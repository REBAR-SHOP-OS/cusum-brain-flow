
-- Change all NO ACTION foreign keys referencing auth.users to SET NULL

ALTER TABLE public.team_channels DROP CONSTRAINT team_channels_created_by_fkey;
ALTER TABLE public.team_channels ADD CONSTRAINT team_channels_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.field_audit_trail DROP CONSTRAINT field_audit_trail_changed_by_fkey;
ALTER TABLE public.field_audit_trail ADD CONSTRAINT field_audit_trail_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.communications DROP CONSTRAINT communications_user_id_fkey;
ALTER TABLE public.communications ADD CONSTRAINT communications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.estimation_learnings DROP CONSTRAINT estimation_learnings_created_by_fkey;
ALTER TABLE public.estimation_learnings ADD CONSTRAINT estimation_learnings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.suggestions DROP CONSTRAINT suggestions_shown_to_fkey;
ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_shown_to_fkey
  FOREIGN KEY (shown_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.command_log DROP CONSTRAINT command_log_user_id_fkey;
ALTER TABLE public.command_log ADD CONSTRAINT command_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.barlists DROP CONSTRAINT barlists_verified_by_fkey;
ALTER TABLE public.barlists ADD CONSTRAINT barlists_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clearance_evidence DROP CONSTRAINT clearance_evidence_verified_by_fkey;
ALTER TABLE public.clearance_evidence ADD CONSTRAINT clearance_evidence_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.agent_action_log DROP CONSTRAINT agent_action_log_user_id_fkey;
ALTER TABLE public.agent_action_log ADD CONSTRAINT agent_action_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.penny_collection_queue DROP CONSTRAINT penny_collection_queue_approved_by_fkey;
ALTER TABLE public.penny_collection_queue ADD CONSTRAINT penny_collection_queue_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.loading_checklist DROP CONSTRAINT loading_checklist_loaded_by_fkey;
ALTER TABLE public.loading_checklist ADD CONSTRAINT loading_checklist_loaded_by_fkey
  FOREIGN KEY (loaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_stage_order DROP CONSTRAINT pipeline_stage_order_updated_by_fkey;
ALTER TABLE public.pipeline_stage_order ADD CONSTRAINT pipeline_stage_order_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.bank_feed_balances DROP CONSTRAINT bank_feed_balances_updated_by_fkey;
ALTER TABLE public.bank_feed_balances ADD CONSTRAINT bank_feed_balances_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_ai_actions DROP CONSTRAINT pipeline_ai_actions_created_by_fkey;
ALTER TABLE public.pipeline_ai_actions ADD CONSTRAINT pipeline_ai_actions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.scheduled_activities DROP CONSTRAINT scheduled_activities_assigned_to_fkey;
ALTER TABLE public.scheduled_activities ADD CONSTRAINT scheduled_activities_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.scheduled_activities DROP CONSTRAINT scheduled_activities_created_by_fkey;
ALTER TABLE public.scheduled_activities ADD CONSTRAINT scheduled_activities_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.quote_templates DROP CONSTRAINT quote_templates_created_by_fkey;
ALTER TABLE public.quote_templates ADD CONSTRAINT quote_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_contracts DROP CONSTRAINT employee_contracts_created_by_fkey;
ALTER TABLE public.employee_contracts ADD CONSTRAINT employee_contracts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.salary_history DROP CONSTRAINT salary_history_approved_by_fkey;
ALTER TABLE public.salary_history ADD CONSTRAINT salary_history_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_certifications DROP CONSTRAINT employee_certifications_created_by_fkey;
ALTER TABLE public.employee_certifications ADD CONSTRAINT employee_certifications_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
