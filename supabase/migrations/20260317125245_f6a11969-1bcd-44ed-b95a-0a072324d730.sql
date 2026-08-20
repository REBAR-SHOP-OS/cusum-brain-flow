
-- Create purchasing_list_items table
CREATE TABLE public.purchasing_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  is_purchased boolean NOT NULL DEFAULT false,
  purchased_by uuid,
  purchased_at timestamptz,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  category text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchasing_list_items ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can access items in their company
CREATE POLICY "Users can view purchasing items in their company"
ON public.purchasing_list_items FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Users can insert purchasing items in their company"
ON public.purchasing_list_items FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Users can update purchasing items in their company"
ON public.purchasing_list_items FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Users can delete purchasing items in their company"
ON public.purchasing_list_items FOR DELETE TO authenticated
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Indexes
CREATE INDEX idx_purchasing_list_company ON public.purchasing_list_items(company_id);
CREATE INDEX idx_purchasing_list_due_date ON public.purchasing_list_items(due_date);
CREATE INDEX idx_purchasing_list_status ON public.purchasing_list_items(is_purchased);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchasing_list_items;

-- Updated_at trigger
CREATE TRIGGER update_purchasing_list_items_updated_at
BEFORE UPDATE ON public.purchasing_list_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
