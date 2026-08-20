-- Allow authenticated users to upload files to estimation-files bucket
CREATE POLICY "Authenticated users can upload to estimation-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'estimation-files');

-- Allow public read access to estimation-files bucket
CREATE POLICY "Public read access to estimation-files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'estimation-files');

-- Allow authenticated users to update their uploads in estimation-files
CREATE POLICY "Authenticated users can update estimation-files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'estimation-files');
