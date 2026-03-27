

# Fix: Face Enrollment Storage Upload Fails for Admin

## Root Cause
The `face-enrollments` storage bucket has these RLS policies:
- **INSERT**: Only allows `auth.uid() = foldername(name)[1]` — users can only upload to their own folder
- **SELECT (admin)**: Admins can view all photos ✓
- **No admin INSERT policy** ← This is the problem

When an admin enrolls photos for another person (Zahra Zokaei), the file path is `{zahra_user_id}/photo-xxx.jpg`, but the logged-in user is `ai@rebar.shop`. The storage RLS blocks it.

## Fix

**Database migration** — Add admin INSERT and DELETE policies to the storage bucket:

```sql
CREATE POLICY "Admins can upload face photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'face-enrollments'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete face photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'face-enrollments'
  AND has_role(auth.uid(), 'admin'::app_role)
);
```

No code changes needed — the upload logic in `FaceMemoryPanel.tsx` is correct. The issue is purely a missing storage permission.

## Files Changed
- Database migration only (2 new storage RLS policies)

