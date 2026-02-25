

## Fix Screenshot Feedback Send Error

### Root Cause

The screenshot feedback send fails because of a **storage upload RLS policy restriction**:

The `clearance-photos` bucket upload policy (`Admin and workshop can upload clearance photos`) only allows users with `admin` or `workshop` roles:

```sql
WITH CHECK (bucket_id = 'clearance-photos' AND has_any_role(auth.uid(), ARRAY['admin', 'workshop']))
```

Internal `@rebar.shop` users who don't have `admin` or `workshop` roles (e.g., estimators, sales staff) will get a permission denied error when trying to upload the screenshot blob. The error cascades and shows as "Failed to send feedback".

### Fix

**1. Update storage RLS policy** (SQL migration)

Broaden the upload policy for the `feedback-screenshots/` path within the `clearance-photos` bucket to allow any authenticated user, while keeping the existing restriction for other paths:

```sql
DROP POLICY "Admin and workshop can upload clearance photos" ON storage.objects;

CREATE POLICY "Upload clearance photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clearance-photos'
  AND (
    -- Feedback screenshots: any authenticated user
    (storage.foldername(name))[1] = 'feedback-screenshots'
    OR
    -- All other paths: admin or workshop only
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  )
);
```

**2. No code changes needed**

The existing `AnnotationOverlay.tsx` and `ScreenshotFeedbackButton.tsx` code is correct. Once the RLS policy allows authenticated users to upload to the `feedback-screenshots/` path, the flow will work end-to-end:

1. Screenshot captured via html2canvas
2. Canvas exported as PNG blob
3. Uploaded to `clearance-photos/feedback-screenshots/{companyId}/{timestamp}.png`
4. Public URL retrieved
5. Task + notification created for Radin

### What Stays the Same
- `AnnotationOverlay.tsx` -- no changes
- `ScreenshotFeedbackButton.tsx` -- no changes
- `tasks` table policies -- already allow inserts for same-company users
- `notifications` table -- unchanged
- All other storage policies -- unchanged
