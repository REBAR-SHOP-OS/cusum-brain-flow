

## Audit Findings and Fixes

### Issue 1: Notification Permission Keeps Re-appearing

**Root cause**: The `requestNotificationPermission()` function uses an in-memory flag (`permissionRequested`) that resets on every page reload. If a user *dismisses* the browser prompt without choosing Allow/Block, `Notification.permission` stays `"default"` and the prompt reappears on every session.

**Fix**: 
- Use `localStorage` to persist a flag (`notification_permission_asked`) so the prompt is shown at most once per device.
- Only re-ask if the user has never been prompted before (not on every page load).
- Also skip calling `registerPushSubscription()` if permission is not `"granted"`.

**File**: `src/lib/browserNotification.ts`

---

### Issue 2: File Uploads Broken (Private Bucket + Public URL)

**Root cause**: The `team-chat-files` storage bucket is **private** (not public), but the code calls `getPublicUrl()` which generates a URL that returns 400/403 for private buckets. Uploaded files are invisible to recipients.

**Fix**: 
- Use `createSignedUrl()` with a long expiry (e.g., 7 days) instead of `getPublicUrl()` for file attachments.
- When rendering attachments in messages, generate signed URLs on-the-fly or at message display time.

**File**: `src/components/teamhub/MessageThread.tsx` (upload handler and attachment rendering)

---

### Issue 3: DM Creation Error (RLS Policy Applied But May Need Refresh)

**Root cause**: The migration to fix `team_channels` INSERT policy has been applied. The policies now correctly allow `created_by = auth.uid()`. The screenshot error is from before the fix. No code changes needed -- this should work now.

**Verification**: The current database policies confirm the fix is live:
- `team_channels` INSERT: allows `company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR created_by = auth.uid()`
- `team_channel_members` INSERT: allows `is_channel_member() OR admin OR channel creator`

---

### Issue 4: Voice Input and Emoji Picker Visibility on Mobile

**Root cause**: The composer toolbar buttons (emoji, voice, file upload) are present in code but may appear too small or not visible on mobile due to the compact layout. The screenshot shows only "Message..." text with no visible toolbar icons.

**Fix**: 
- Ensure the toolbar buttons have adequate touch targets on mobile (min 44x44px).
- Make the bottom toolbar always visible and not hidden behind overflow.

**File**: `src/components/teamhub/MessageThread.tsx` (composer section)

---

### Technical Steps

1. **`src/lib/browserNotification.ts`**:
   - Replace in-memory `permissionRequested` flag with `localStorage.getItem("notification_permission_asked")`
   - Only prompt if never asked before AND permission is `"default"`
   - After prompting, set `localStorage.setItem("notification_permission_asked", "true")`
   - Skip push registration if permission is not granted

2. **`src/components/teamhub/MessageThread.tsx`**:
   - Change `getPublicUrl()` to `createSignedUrl(path, 604800)` (7 days) in the upload handler
   - Add a helper to generate signed URLs for displaying existing attachments
   - Increase touch target size for emoji/voice/upload buttons on mobile (min `h-10 w-10`)
   - Ensure toolbar is always visible (not clipped)

3. **`src/hooks/useTeamChat.ts`**:
   - No changes needed (attachments field already supported)

