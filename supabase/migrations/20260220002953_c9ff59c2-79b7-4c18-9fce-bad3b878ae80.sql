
-- Phase 17: QuickBooks Integration Expansion

-- 1. qb_classes table
CREATE TABLE public.qb_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_qb_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  raw_json JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_qb_classes_company_qb ON public.qb_classes (company_id, qb_id);
ALTER TABLE public.qb_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own company classes" ON public.qb_classes FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Service role full access qb_classes" ON public.qb_classes FOR ALL USING (true) WITH CHECK (true);

-- 2. qb_departments table
CREATE TABLE public.qb_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  qb_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  raw_json JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_qb_departments_company_qb ON public.qb_departments (company_id, qb_id);
ALTER TABLE public.qb_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own company departments" ON public.qb_departments FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Service role full access qb_departments" ON public.qb_departments FOR ALL USING (true) WITH CHECK (true);

-- 3. Add class/department columns to qb_transactions
ALTER TABLE public.qb_transactions ADD COLUMN IF NOT EXISTS class_qb_id TEXT;
ALTER TABLE public.qb_transactions ADD COLUMN IF NOT EXISTS department_qb_id TEXT;

-- 4. qb_webhook_events table for audit logging
CREATE TABLE public.qb_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,
  realm_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  raw_payload JSONB,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qb_webhook_events_realm ON public.qb_webhook_events (realm_id, created_at DESC);
ALTER TABLE public.qb_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view webhook events" ON public.qb_webhook_events FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Service role full access qb_webhook_events" ON public.qb_webhook_events FOR ALL USING (true) WITH CHECK (true);
