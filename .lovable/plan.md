

# Fix: History Projects Missing Videos

## Root Cause
When scenes finish generating, clip URLs are uploaded to storage but the **project record in the database is never updated** with those new URLs. The project auto-save only happens at two points:
1. After script analysis → saves clips as `{ status: "idle", progress: 0 }` (no videoUrl)
2. After export → saves completed clips

So if a user generates all scenes but doesn't export, the DB still holds idle clips with no URLs. Loading from history restores these empty clips → "No video available".

## Fix

### 1. Auto-save project when clips update to "completed"
Add a `useEffect` in `AdDirectorContent.tsx` that watches the `clips` array and triggers a project save whenever a clip transitions to "completed" with a storage URL. This ensures the DB always has the latest clip state.

### 2. Smarter step routing on project load
In `handleLoadProject`, check if any clips have `status === "completed"` with a `videoUrl` → go directly to `"preview"` step instead of always landing on `"storyboard"`.

### 3. Show actionable empty state
In `ProVideoEditor`, when there's no video, show a message like "Generate scenes first" with a back button, instead of just "No video available".

## Files Modified
- `src/components/ad-director/AdDirectorContent.tsx` — add auto-save effect for clips, fix step routing
- `src/components/ad-director/ProVideoEditor.tsx` — improve empty state message

