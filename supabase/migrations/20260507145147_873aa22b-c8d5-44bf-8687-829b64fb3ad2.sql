-- 1) Restrict public bucket SELECT policies to authenticated users only.
-- Files remain accessible via the public object URL (CDN bypasses RLS), but
-- the storage API list/select endpoints will no longer enumerate for anon.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Authenticated can view avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can view shape schematics" ON storage.objects;
CREATE POLICY "Authenticated can view shape schematics"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shape-schematics');

DROP POLICY IF EXISTS "Public can read support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Agents can read support attachments" ON storage.objects;
CREATE POLICY "Authenticated can read support attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS "Public read access for ad assets" ON storage.objects;
CREATE POLICY "Authenticated can read ad assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-assets');

DROP POLICY IF EXISTS "Public read access for social media assets" ON storage.objects;
CREATE POLICY "Authenticated can read social media assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'social-media-assets');

DROP POLICY IF EXISTS "Public read brand assets" ON storage.objects;
CREATE POLICY "Authenticated can read brand assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Public read generated videos" ON storage.objects;
CREATE POLICY "Authenticated can read generated videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generated-videos');

DROP POLICY IF EXISTS "Public read social-images" ON storage.objects;
CREATE POLICY "Authenticated can read social-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'social-images');

DROP POLICY IF EXISTS "Authenticated users can view clearance photos" ON storage.objects;
CREATE POLICY "Authenticated can view clearance photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'clearance-photos');

DROP POLICY IF EXISTS "Authenticated users can read estimation-files" ON storage.objects;
CREATE POLICY "Authenticated can read estimation-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'estimation-files');

-- 2) Revoke EXECUTE from anon/authenticated on SECURITY DEFINER trigger functions.
-- These are invoked by triggers (table writes), never directly via the public API.
DO $$
DECLARE
  fn_name text;
  fn_signature text;
  fn_list text[] := ARRAY[
    'assign_leave_approver','audit_contact_changes','audit_financial_access','audit_salary_access',
    'auto_add_to_general_channel','auto_advance_cleared_item','auto_advance_plan_status',
    'auto_assign_agent','auto_complete_cut_plan','auto_create_bend_batch','auto_create_bend_batch_from_phase',
    'auto_create_delivery_on_staged','auto_generate_production_tasks','auto_score_on_stage_change',
    'cleanup_old_backups','generate_expense_claim_number','generate_receipt_number','handle_new_user',
    'log_project_task_event','log_quotation_status_change','mirror_delivery_to_order',
    'normalize_lead_probability','notify_feedback_owner_on_resolve','notify_human_task',
    'notify_leave_request','notify_on_support_message','notify_on_team_message',
    'notify_order_status_change','notify_quote_request','notify_quote_request_push',
    'protect_manager_id','protect_profile_company_id','protect_profile_user_id',
    'push_on_notification_insert','recalc_expense_claim_total','recalc_order_total',
    'restrict_signups','sync_quote_to_lead_expected_value','track_field_changes',
    'translate_notification_trigger','trg_prevent_comma_customer','trg_recompute_order_on_task_change',
    'trigger_after_loss','trigger_after_outcome','trigger_score_after_qualification',
    'trigger_score_after_quote','update_leave_balance_on_approval','validate_cut_plan_status',
    'audit_contact_changes','log_contact_access','log_contact_bulk_access',
    'auto_score_on_stage_change'
  ];
BEGIN
  FOREACH fn_name IN ARRAY fn_list LOOP
    FOR fn_signature IN
      SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn_name AND p.prosecdef=true
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', fn_signature);
    END LOOP;
  END LOOP;
END $$;

-- 3) Realtime: require authentication for any topic subscription.
-- This blocks anonymous (signed out) clients from subscribing to any channel.
-- Tightening per-topic by company is left for a follow-up pass since channels
-- across the app use varied topic naming conventions.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can broadcast to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can broadcast to realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
