

# Add Timeout Alert + Active Task Indicator on Preview & Export

## Problem
When the user is on the "Preview & Export" tab, there's no indication of what's happening in the background (analysis, generation). If a process times out silently, the user sees nothing — just an empty screen.

## Changes

### 1. Add timeout detection to `handleAnalyze` in `AdDirectorContent.tsx`
Wrap each `invokeEdgeFunction` call with a timeout race (90 seconds). If it exceeds the limit, catch the timeout and show a destructive toast: "Analysis timed out — the AI model took too long. Please try again."

### 2. Show active task status on the Preview & Export tab
When `analyzing` or `generatingAny` or `exporting` is true, render a status banner inside the Preview & Export view (above the FinalPreview component) showing:
- A spinner + current status text (e.g., "Analyzing script structure..." or "Generating scene 3/7...")
- Progress bar with percentage
- This ensures the user always knows what's happening regardless of which tab they're on

### 3. Add generation progress tracking
Add a `generationStatus` state string. Update `generateScene` and `handleGenerateAll` to set it (e.g., "Generating scene 2 of 7..."). Show this in the global progress bar alongside `analysisStatus`.

## Files Modified
- `src/components/ad-director/AdDirectorContent.tsx` — add timeout wrapper, generation status state, render status banner on preview tab

