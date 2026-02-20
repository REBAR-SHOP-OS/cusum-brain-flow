
-- ============================================================
-- AUTOMATION ENGINE SCHEMA
-- ============================================================

-- 1. automation_runs: Track every automation execution
CREATE TABLE public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  automation_key TEXT NOT NULL,
  automation_name TEXT NOT NULL,
  agent_name TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  items_processed INT DEFAULT 0,
  items_succeeded INT DEFAULT 0,
  items_failed INT DEFAULT 0,
  error_log JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for automation_runs
CREATE OR REPLACE FUNCTION public.validate_automation_run_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('running', 'completed', 'failed', 'partial') THEN
    RAISE EXCEPTION 'Invalid automation_run status: %', NEW.status;
  END IF;
  IF NEW.trigger_type NOT IN ('manual', 'cron', 'db_trigger', 'webhook') THEN
    RAISE EXCEPTION 'Invalid automation_run trigger_type: %', NEW.trigger_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_automation_run
BEFORE INSERT OR UPDATE ON public.automation_runs
FOR EACH ROW EXECUTE FUNCTION public.validate_automation_run_status();

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company automation runs"
ON public.automation_runs FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Service role full access automation_runs"
ON public.automation_runs FOR ALL
USING (true) WITH CHECK (true);

-- 2. customer_health_scores: Cached per-customer health
CREATE TABLE public.customer_health_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  overall_score NUMERIC DEFAULT 0,
  payment_score NUMERIC DEFAULT 0,
  engagement_score NUMERIC DEFAULT 0,
  loyalty_score NUMERIC DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  factors JSONB,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, customer_id)
);

ALTER TABLE public.customer_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company health scores"
ON public.customer_health_scores FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Service role full access health_scores"
ON public.customer_health_scores FOR ALL
USING (true) WITH CHECK (true);

-- 3. Add lead_id to orders (link orders back to pipeline)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

-- 4. Add automation_source to activity_events
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS automation_source TEXT;

-- 5. Automation config table (stores enabled/disabled + config per automation)
CREATE TABLE public.automation_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  automation_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  agent_name TEXT,
  tier INT DEFAULT 1,
  category TEXT DEFAULT 'operations',
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  total_runs INT DEFAULT 0,
  total_success INT DEFAULT 0,
  total_failed INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, automation_key)
);

ALTER TABLE public.automation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company automation configs"
ON public.automation_configs FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage automation configs"
ON public.automation_configs FOR ALL
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Service role full access automation_configs"
ON public.automation_configs FOR ALL
USING (true) WITH CHECK (true);

-- Enable realtime for automation_runs
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_configs;

-- 6. Seed default automation configs for company a0000000-0000-0000-0000-000000000001
INSERT INTO public.automation_configs (company_id, automation_key, name, description, agent_name, tier, category, enabled) VALUES
('a0000000-0000-0000-0000-000000000001', 'auto_approve_penny', 'Auto-Approve Collections <$5K', 'Auto-approve Penny collection actions for invoices under $5K and 30+ days overdue', 'Penny', 1, 'revenue', false),
('a0000000-0000-0000-0000-000000000001', 'auto_create_order', 'Auto-Create Orders from Won Leads', 'Automatically create orders when leads move to won stage', 'Gauge', 1, 'revenue', false),
('a0000000-0000-0000-0000-000000000001', 'ar_aging_escalation', 'AR Aging Escalation Ladder', 'Escalate overdue invoices at 30/60/90 day thresholds', 'Penny', 1, 'revenue', false),
('a0000000-0000-0000-0000-000000000001', 'pipeline_lead_recycler', 'Dead Lead Recycler', 'Auto follow-up stale leads, mark lost after 30 days', 'Blitz', 2, 'pipeline', false),
('a0000000-0000-0000-0000-000000000001', 'pipeline_comm_gap_filler', 'Communication Gap Closer', 'Auto-send intro emails to leads with zero communications', 'Blitz', 2, 'pipeline', false),
('a0000000-0000-0000-0000-000000000001', 'estimation_auto_queue', 'Estimation Auto-Queue', 'Auto-trigger AI estimation when leads with files enter estimation stages', 'Atlas', 2, 'pipeline', false),
('a0000000-0000-0000-0000-000000000001', 'quote_expiry_watchdog', 'Quote Expiry Watchdog', 'Alert on expiring quotes, auto-move stale leads', 'Gauge', 2, 'pipeline', false),
('a0000000-0000-0000-0000-000000000001', 'auto_generate_work_order', 'Auto-Generate Work Orders', 'Create work orders when shop drawings are approved', 'Forge', 3, 'production', false),
('a0000000-0000-0000-0000-000000000001', 'auto_schedule_delivery', 'Auto-Schedule Delivery', 'Create delivery when production completes', 'Forge', 3, 'production', false),
('a0000000-0000-0000-0000-000000000001', 'inventory_auto_reorder', 'Inventory Auto-Reorder', 'Auto-create PO drafts when stock drops below threshold', 'Forge', 3, 'production', false),
('a0000000-0000-0000-0000-000000000001', 'win_loss_analyzer', 'Win/Loss Pattern Analyzer', 'Weekly analysis of won vs lost leads to optimize scoring', 'Atlas', 4, 'intelligence', false),
('a0000000-0000-0000-0000-000000000001', 'customer_health_score', 'Customer Health Score', 'Daily customer risk scoring based on payment and engagement', 'Atlas', 4, 'intelligence', false),
('a0000000-0000-0000-0000-000000000001', 'smart_quote_pricing', 'Smart Quote Pricing', 'AI-suggested pricing based on historical win rates', 'Gauge', 4, 'intelligence', false),
('a0000000-0000-0000-0000-000000000001', 'cert_expiry_tracker', 'Certification Expiry Tracker', 'Alert on expiring employee certifications', 'Vizzy', 5, 'hr', false),
('a0000000-0000-0000-0000-000000000001', 'payroll_anomaly_detector', 'Payroll Anomaly Detector', 'Flag unusual timeclock patterns', 'Vizzy', 5, 'hr', false),
('a0000000-0000-0000-0000-000000000001', 'customer_milestone_notify', 'Project Status Auto-Updates', 'Auto-email customers at order milestones', 'Relay', 6, 'customer', false),
('a0000000-0000-0000-0000-000000000001', 'post_delivery_nurture', 'Post-Delivery Follow-Up', 'Automated thank-you, survey, and re-engagement after delivery', 'Relay', 6, 'customer', false);
