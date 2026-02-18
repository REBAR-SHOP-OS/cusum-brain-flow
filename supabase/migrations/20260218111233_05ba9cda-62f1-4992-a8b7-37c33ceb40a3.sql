
-- Quote Templates: reusable quotation blueprints
CREATE TABLE public.quote_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  customer_type TEXT, -- e.g. 'commercial', 'residential', 'government'
  default_tax_rate NUMERIC NOT NULL DEFAULT 0.13,
  default_valid_days INTEGER NOT NULL DEFAULT 30,
  inclusions TEXT[] DEFAULT '{}',
  exclusions TEXT[] DEFAULT '{}',
  terms TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quote Template Line Items
CREATE TABLE public.quote_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.quote_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_quote_templates_company ON public.quote_templates(company_id);
CREATE INDEX idx_quote_template_items_template ON public.quote_template_items(template_id);

-- RLS
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates in their company"
  ON public.quote_templates FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create templates in their company"
  ON public.quote_templates FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update templates in their company"
  ON public.quote_templates FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete templates in their company"
  ON public.quote_templates FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Template items inherit access from parent template
CREATE POLICY "Users can view template items"
  ON public.quote_template_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quote_templates t
    WHERE t.id = template_id AND t.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can manage template items"
  ON public.quote_template_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quote_templates t
    WHERE t.id = template_id AND t.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can update template items"
  ON public.quote_template_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quote_templates t
    WHERE t.id = template_id AND t.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can delete template items"
  ON public.quote_template_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quote_templates t
    WHERE t.id = template_id AND t.company_id = public.get_user_company_id(auth.uid())
  ));

-- Audit trail
CREATE TRIGGER audit_quote_templates
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();
