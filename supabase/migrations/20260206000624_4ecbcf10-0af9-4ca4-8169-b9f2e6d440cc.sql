-- ============================================
-- CUSUM Database Schema - Core Business Tables
-- Based on Master Plan Domains
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CUSTOMERS (CRM - Core entity)
-- ============================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  customer_type TEXT DEFAULT 'business', -- business, residential
  status TEXT DEFAULT 'active', -- active, inactive, prospect
  quickbooks_id TEXT, -- QB sync reference
  credit_limit NUMERIC(12,2),
  payment_terms TEXT DEFAULT 'net30',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. CONTACTS (Linked to customers)
-- ============================================
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT, -- primary, billing, shipping, etc.
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. TASKS (Communications → Tasks)
-- ============================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open', -- open, in_progress, completed, cancelled
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  due_date TIMESTAMPTZ,
  assigned_to UUID, -- future: link to users
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  source TEXT, -- email, call, manual, agent
  source_ref TEXT, -- gmail message id, call id, etc.
  agent_type TEXT, -- sales, accounting, support, collections, estimation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 4. QUOTES (Sales domain)
-- ============================================
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  total_amount NUMERIC(12,2) DEFAULT 0,
  margin_percent NUMERIC(5,2),
  valid_until TIMESTAMPTZ,
  notes TEXT,
  created_by UUID, -- future: link to users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 5. ORDERS (Sales → Execution)
-- ============================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, confirmed, in_production, ready, shipped, completed, cancelled
  order_date TIMESTAMPTZ DEFAULT now(),
  required_date TIMESTAMPTZ,
  total_amount NUMERIC(12,2) DEFAULT 0,
  quickbooks_invoice_id TEXT, -- QB sync reference
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. WORK_ORDERS (Execution / Shop Floor)
-- ============================================
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'queued', -- queued, in_progress, paused, completed, exception
  priority INTEGER DEFAULT 0,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  workstation TEXT,
  assigned_to TEXT, -- worker name or id
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 7. DELIVERIES (Delivery domain)
-- ============================================
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'planned', -- planned, loading, in_transit, delivered, exception
  scheduled_date TIMESTAMPTZ,
  driver_name TEXT,
  vehicle TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Delivery stops (multiple per delivery)
CREATE TABLE public.delivery_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  stop_sequence INTEGER NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'pending', -- pending, arrived, completed, failed, skipped
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  pod_signature TEXT, -- proof of delivery
  pod_photo_url TEXT,
  exception_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 8. ACCOUNTING_MIRROR (QB read-only sync)
-- ============================================
CREATE TABLE public.accounting_mirror (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- customer, invoice, payment, credit_memo
  quickbooks_id TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  data JSONB NOT NULL, -- raw QB data
  balance NUMERIC(12,2),
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, quickbooks_id)
);

-- ============================================
-- 9. EVENTS (Audit log / Timeline)
-- ============================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- created, updated, status_change, email_sent, call_logged, etc.
  entity_type TEXT NOT NULL, -- customer, order, quote, task, etc.
  entity_id UUID NOT NULL,
  actor_type TEXT DEFAULT 'user', -- user, agent, system
  actor_id TEXT, -- user id or agent name
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 10. COMMUNICATIONS (Gmail/RingCentral sync)
-- ============================================
CREATE TABLE public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- gmail, ringcentral
  source_id TEXT NOT NULL, -- gmail message id, call id
  direction TEXT, -- inbound, outbound
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body_preview TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'unread', -- unread, read, actioned, archived
  thread_id TEXT, -- for email threading
  metadata JSONB,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, source_id)
);

-- ============================================
-- 11. KNOWLEDGE (Brain / RAG storage)
-- ============================================
CREATE TABLE public.knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- product, policy, faq, document
  title TEXT NOT NULL,
  content TEXT,
  source_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 12. INTEGRATION_SETTINGS
-- ============================================
CREATE TABLE public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name TEXT NOT NULL UNIQUE, -- gmail, quickbooks, ringcentral
  status TEXT DEFAULT 'disconnected', -- connected, disconnected, error
  config JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_contacts_customer ON public.contacts(customer_id);
CREATE INDEX idx_tasks_customer ON public.tasks(customer_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_work_orders_order ON public.work_orders(order_id);
CREATE INDEX idx_work_orders_status ON public.work_orders(status);
CREATE INDEX idx_delivery_stops_delivery ON public.delivery_stops(delivery_id);
CREATE INDEX idx_events_entity ON public.events(entity_type, entity_id);
CREATE INDEX idx_events_created ON public.events(created_at DESC);
CREATE INDEX idx_communications_customer ON public.communications(customer_id);
CREATE INDEX idx_communications_status ON public.communications(status);
CREATE INDEX idx_accounting_mirror_customer ON public.accounting_mirror(customer_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.delivery_stops FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.knowledge FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.integration_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- RLS POLICIES (Initially permissive - tighten later with auth)
-- ============================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can CRUD all tables (will tighten with roles later)
CREATE POLICY "Authenticated users full access" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.work_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.delivery_stops FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.accounting_mirror FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.communications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.knowledge FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.integration_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.communications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;