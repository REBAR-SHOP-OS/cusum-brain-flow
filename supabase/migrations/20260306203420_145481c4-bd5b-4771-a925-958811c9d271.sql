-- Make team-chat-files bucket public so URLs never expire
UPDATE storage.buckets SET public = true WHERE id = 'team-chat-files';

-- Allow public read access to all files in the bucket
CREATE POLICY "Public read access on team-chat-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'team-chat-files');
