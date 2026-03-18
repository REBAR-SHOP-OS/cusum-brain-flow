

## Assessment: Client-Side Compression Exists But Only in 1 of 30+ Upload Points

### Current State

- **`src/lib/imageCompressor.ts`** — client-side compression utility (resize to 2048px, JPEG 80%) already exists
- **Only used in 1 place**: `ClearanceCard.tsx` imports and uses `compressImage` before upload
- **30+ other upload points** across the codebase (estimation, social media, brand assets, support attachments, chat uploads, avatars, etc.) upload images **raw** without compression

### Why a Server-Side Approach is Better

Rather than retrofitting `compressImage()` into 30+ components (fragile, easy to miss), a **storage trigger → edge function** pipeline catches ALL uploads automatically.

However, there's a critical limitation: **Supabase doesn't support database triggers on `storage.objects` in Lovable Cloud** — we can't attach triggers to the `storage` schema. The bug report's suggested approach won't work here.

### Recommended Fix: Shared Client-Side Compression Wrapper

Instead, create a **drop-in replacement** for `supabase.storage.from().upload()` that auto-compresses images before uploading.

### Changes

**1. Create `src/lib/storageUpload.ts`** — Smart upload wrapper
- Wraps `supabase.storage.from(bucket).upload(path, file, opts)`
- Auto-calls `compressImage()` for any image file before uploading
- Non-images pass through unchanged
- All existing upload call sites switch to this single function

**2. Update ~15 key upload components** to use the new wrapper
Replace direct `supabase.storage.from(...).upload(...)` calls with `uploadToStorage(bucket, path, file, opts)`:
- `TakeoffWizard.tsx` (estimation uploads)
- `CreateContentDialog.tsx` (social media)
- `ProVideoEditor.tsx` (brand assets/logo)
- `SupportChatView.tsx` (support attachments)
- `WebsiteChat.tsx` (chat uploads)
- `VizzyPhotoButton.tsx` (vizzy photos)
- `EmpireBuilder.tsx` (chat uploads)
- `useAvatarUpload.ts` (avatar uploads)
- `socialMediaStorage.ts` (social assets)
- `zipAnalyzer.ts` (zip image extraction)
- And remaining upload points found in the codebase

**3. Keep `ClearanceCard.tsx` as-is** — already compresses correctly

### Result
- Every image upload across the entire app is compressed to ≤2048px JPEG at 80% quality
- Single point of control for compression settings
- No backend changes needed, no schema modifications
- Transparent to users — same API, smaller files

