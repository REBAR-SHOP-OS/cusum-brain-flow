
# Fix "Failed to fetch" on Lead File Downloads

## Problem

Files attached to leads (PDFs, DWGs, ZIPs, images, etc.) fail to download with "TypeError: Failed to fetch" errors. This affects all file types displayed in the pipeline lead timeline.

## Root Cause

The `LeadTimeline.tsx` component uses `supabase.storage.from("estimation-files").getPublicUrl(...)` to generate download URLs. However, the `estimation-files` bucket is **private** (not public). `getPublicUrl()` generates a URL that requires no authentication, which returns a 403 error on private buckets.

Other components (`LeadEmailThread.tsx`, `LeadFiles.tsx`) already use `getSignedFileUrl()` correctly -- only the timeline is broken.

## Fix

### File: `src/components/pipeline/LeadTimeline.tsx`

Replace the `getPublicUrl()` call with `getSignedFileUrl()` from `@/lib/storageUtils` (the same utility used everywhere else).

**Before (broken):**
```typescript
const { data } = supabase.storage.from("estimation-files").getPublicUrl(f.storage_path!);
const a = document.createElement("a");
a.href = data.publicUrl;
```

**After (fixed):**
```typescript
const signedUrl = await getSignedFileUrl(f.storage_path!);
if (!signedUrl) return;
window.open(signedUrl, "_blank");
```

This is a one-line logic change -- import `getSignedFileUrl` and replace the public URL call with a signed URL call, matching the pattern already used in `LeadEmailThread.tsx` and `LeadFiles.tsx`.

No database or backend changes needed.
