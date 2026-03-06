
-- Create support-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (agents) to upload
CREATE POLICY "Agents can upload support attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-attachments');

-- Allow authenticated users to read
CREATE POLICY "Agents can read support attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-attachments');

-- Allow public read (for visitor widget to display images)
CREATE POLICY "Public can read support attachments"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'support-attachments');

-- Allow service role full access (for edge function uploads)
CREATE POLICY "Service role full access support attachments"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'support-attachments')
WITH CHECK (bucket_id = 'support-attachments');
