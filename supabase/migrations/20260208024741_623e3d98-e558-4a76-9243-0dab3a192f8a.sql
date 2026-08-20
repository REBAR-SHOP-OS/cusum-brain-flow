
-- Make estimation-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'estimation-files';
