
-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoice-pdfs', 'invoice-pdfs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoice-pdfs bucket
CREATE POLICY "Authenticated users can upload invoice PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-pdfs');

CREATE POLICY "Authenticated users can read invoice PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-pdfs');

CREATE POLICY "Service role full access to invoice PDFs"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'invoice-pdfs');
