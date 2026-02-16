
-- Code patches table for AI Code Engineer review workflow
CREATE TABLE public.code_patches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID NOT NULL,
  target_system TEXT NOT NULL DEFAULT 'odoo',
  file_path TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  patch_content TEXT NOT NULL,
  patch_type TEXT NOT NULL DEFAULT 'unified_diff',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_code_patch_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'applied') THEN
    RAISE EXCEPTION 'Invalid code_patch status: %', NEW.status;
  END IF;
  IF NEW.target_system NOT IN ('odoo', 'erp', 'wordpress', 'other') THEN
    RAISE EXCEPTION 'Invalid target_system: %', NEW.target_system;
  END IF;
  IF NEW.patch_type NOT IN ('unified_diff', 'full_file', 'snippet') THEN
    RAISE EXCEPTION 'Invalid patch_type: %', NEW.patch_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_code_patch_fields_trigger
BEFORE INSERT OR UPDATE ON public.code_patches
FOR EACH ROW EXECUTE FUNCTION public.validate_code_patch_fields();

-- Updated_at trigger
CREATE TRIGGER update_code_patches_updated_at
BEFORE UPDATE ON public.code_patches
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.code_patches ENABLE ROW LEVEL SECURITY;

-- Users can see patches in their company
CREATE POLICY "Users can view company patches"
ON public.code_patches FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

-- Users can create patches
CREATE POLICY "Users can create patches"
ON public.code_patches FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND company_id = public.get_user_company_id(auth.uid())
);

-- Admins can update patches (approve/reject)
CREATE POLICY "Admins can update patches"
ON public.code_patches FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Service role can insert (from edge functions)
CREATE POLICY "Service role full access"
ON public.code_patches FOR ALL
USING (auth.role() = 'service_role');
