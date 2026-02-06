-- Create storage bucket for estimation files (drawings, AutoCAD, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimation-files',
  'estimation-files',
  false,
  524288000, -- 500MB limit
  NULL -- No mime type restrictions - allow all file types including AutoCAD
);

-- RLS policies for estimation-files bucket
CREATE POLICY "Users can upload their own estimation files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'estimation-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own estimation files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'estimation-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own estimation files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'estimation-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);