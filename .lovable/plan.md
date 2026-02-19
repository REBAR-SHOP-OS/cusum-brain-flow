
# Fix: Screenshot Images Not Loading in Task Details

## Scope
- Database: Make the `clearance-photos` storage bucket public
- Code: `src/pages/Tasks.tsx` — fix a regex bug in `linkifyText` that can cause URL detection to fail intermittently
- No other files, components, or UI touched

## Root Cause

The feedback tool uploads screenshots to the `clearance-photos` storage bucket and stores a "public URL" in the task description. However, the bucket is configured as **private** (`public: false`).

When the task detail view tries to render the image using that URL, the storage API returns:
```json
{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}
```

This is why the screenshot appears as a broken image icon with the alt text "Screenshot" — exactly what the user sees.

## The Fix

### Change 1 — Make `clearance-photos` bucket public (database migration)

The bucket already has a SELECT RLS policy ("Authenticated users can view clearance photos"), but since the description stores permanent URLs using `getPublicUrl()`, the bucket itself must allow public reads.

```sql
UPDATE storage.buckets
SET public = true
WHERE id = 'clearance-photos';
```

This makes all existing and future screenshot URLs work immediately — no code changes needed for the upload flow.

### Change 2 — Fix regex bug in `linkifyText` (src/pages/Tasks.tsx, line 138-142)

The `urlRegex` is created with the `g` (global) flag and then reused in a `test()` call inside a loop. The global flag causes `lastIndex` to persist between calls, which can make every other URL fail detection. Fix: use a fresh regex for the test.

```diff
  function linkifyText(text: string | null) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const imageExtRegex = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
-     if (urlRegex.test(part)) {
+     if (/^https?:\/\//.test(part)) {
        if (imageExtRegex.test(part)) {
```

## Summary

| What | Change |
|------|--------|
| Storage bucket | `clearance-photos` set to `public = true` |
| `Tasks.tsx` line 142 | Replace `urlRegex.test(part)` with `/^https?:\/\//.test(part)` to avoid global regex state bug |

## No Other Changes
- No other files modified
- No other UI, logic, or database schema altered
- Upload flow in `AnnotationOverlay.tsx` already uses `getPublicUrl()` correctly — it just needs the bucket to actually be public
