
-- Create document_attachments table for unified file attachments across quotes, invoices, orders
CREATE TABLE public.document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('quote', 'invoice', 'order', 'sales_quotation')),
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by entity
CREATE INDEX idx_document_attachments_entity ON public.document_attachments(entity_type, entity_id);
CREATE INDEX idx_document_attachments_company ON public.document_attachments(company_id);

-- Enable RLS
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage attachments for their company
CREATE POLICY "Users can view their company attachments"
  ON public.document_attachments FOR SELECT
  TO authenticated
  USING (company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Users can insert attachments for their company"
  ON public.document_attachments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Users can delete their own attachments"
  ON public.document_attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Create storage bucket for document attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-attachments', 'document-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/read from document-attachments bucket
CREATE POLICY "Authenticated users can upload document attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'document-attachments');

CREATE POLICY "Authenticated users can read document attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'document-attachments');

CREATE POLICY "Users can delete their own document attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'document-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
