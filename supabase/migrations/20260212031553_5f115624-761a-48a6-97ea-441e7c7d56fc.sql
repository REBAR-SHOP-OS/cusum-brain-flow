
-- The first migration failed at the upload policy, so bucket update may not have committed.
-- Re-apply the bucket privacy change.
UPDATE storage.buckets
SET public = false
WHERE id = 'shape-schematics';
