

# Fix: Generation Progress Not Visible

## Root Cause
`handleGenerateAll` loops through scenes calling `generateScene()`, which returns immediately after receiving a `jobId` from the API. The background `pollGeneration` runs asynchronously but `generatingAny` is set to `false` as soon as the loop finishes — not when polling completes. So the progress bar disappears while 7 scenes are still being generated.

## Changes

### 1. Track active polling count (`AdDirectorContent.tsx`)
Add a `pollingCount` ref that increments when `pollGeneration` starts and decrements when it finishes. Derive a `isPolling` boolean from it. Show the global progress bar when `isPolling > 0`.

### 2. Show polling status in global progress bar
When clips are in `generating` status (polling), show a banner like:
- "Generating 7 scenes... 2/7 completed" with a progress bar based on completed/total ratio.

### 3. Show per-clip status on Preview tab
Pass a `generatingCount` prop or derive it from `clips` state. In `FinalPreview`, when clips have `status === "generating"`, show an animated status instead of the static "Generate scenes to preview" message. Show a spinner + "Generating scenes... X/Y completed".

### 4. Keep `generatingAny` true until all polling completes
Instead of relying on `handleGenerateAll`'s loop, derive `generatingAny` from clips state: `const generatingAny = clips.some(c => c.status === "generating")`. Remove the manual `setGeneratingAny` state — compute it reactively.

## Specific Code Changes

**`AdDirectorContent.tsx`**:
- Remove `generatingAny` state, replace with: `const generatingAny = clips.some(c => c.status === "generating")`
- Remove `setGeneratingAny(true/false)` calls from `handleGenerateAll`
- Update global progress bar condition to use computed `generatingAny`
- Update `generationStatus` dynamically based on clips state (compute completed vs total counts)
- Show progress percentage: `completedClips / totalClips * 100`

**`FinalPreview.tsx`**:
- When `clips.some(c => c.status === "generating")`, show a spinner + "Generating X scenes... Y/Z ready" instead of "Generate scenes to preview"
- Add a pulsing animation to the badge showing clip count while generating

## Files Modified
- `src/components/ad-director/AdDirectorContent.tsx`
- `src/components/ad-director/FinalPreview.tsx`

