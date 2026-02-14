
-- Create email_automations table
CREATE TABLE public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  trigger_type text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'nurture',
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority text NOT NULL DEFAULT 'medium',
  company_id uuid NOT NULL,
  last_triggered_at timestamptz,
  campaigns_generated integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as email_campaigns — company-based via profile)
CREATE POLICY "Users can view automations for their company"
  ON public.email_automations FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update automations for their company"
  ON public.email_automations FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert automations for their company"
  ON public.email_automations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_email_automation_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.priority NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid automation priority: %', NEW.priority;
  END IF;
  IF NEW.campaign_type NOT IN ('nurture','follow_up','newsletter','winback','announcement') THEN
    RAISE EXCEPTION 'Invalid automation campaign_type: %', NEW.campaign_type;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_email_automation_fields_trigger
  BEFORE INSERT OR UPDATE ON public.email_automations
  FOR EACH ROW EXECUTE FUNCTION public.validate_email_automation_fields();

-- Updated_at trigger
CREATE TRIGGER update_email_automations_updated_at
  BEFORE UPDATE ON public.email_automations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed 8 automation templates
INSERT INTO public.email_automations (automation_key, name, description, trigger_type, campaign_type, priority, company_id, config) VALUES
('abandoned_cart', 'Abandoned Quote Follow-up', 'Automatically follow up on quotes that have been sent but received no order after 48 hours.', 'quote_stale', 'follow_up', 'high', 'a0000000-0000-0000-0000-000000000001', '{"delay_hours": 48, "quote_status": "sent"}'),
('welcome_series', 'Welcome Series', 'Send a welcome email to every new contact added to the system.', 'new_contact', 'nurture', 'high', 'a0000000-0000-0000-0000-000000000001', '{"delay_hours": 1}'),
('upsell_email', 'Upsell / Cross-sell', 'Suggest related services after an order is completed.', 'order_complete', 'nurture', 'high', 'a0000000-0000-0000-0000-000000000001', '{"delay_hours": 72, "order_status": ["closed", "paid"]}'),
('review_request', 'Review Request', 'Request a review 7 days after order delivery.', 'order_delivered', 'follow_up', 'medium', 'a0000000-0000-0000-0000-000000000001', '{"delay_days": 7}'),
('birthday_promo', 'Birthday / Anniversary', 'Send a personalized email on contact anniversary dates.', 'contact_anniversary', 'nurture', 'medium', 'a0000000-0000-0000-0000-000000000001', '{"check_field": "created_at"}'),
('price_stock_alert', 'Price/Stock Alert', 'Notify customers about price changes or inventory updates.', 'inventory_change', 'announcement', 'medium', 'a0000000-0000-0000-0000-000000000001', '{"manual_trigger": true}'),
('vip_email', 'VIP Recognition', 'Recognize customers who exceed an order count threshold.', 'vip_threshold', 'nurture', 'low', 'a0000000-0000-0000-0000-000000000001', '{"order_count_threshold": 10}'),
('winback', 'Win-Back', 'Re-engage customers with no orders in 90+ days.', 'no_recent_orders', 'winback', 'low', 'a0000000-0000-0000-0000-000000000001', '{"inactive_days": 90}');
