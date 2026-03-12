

# Improve Analysis Feedback — Always-Visible Progress

## Problem
The analysis progress indicator is only visible on the "Script & Assets" tab. If you navigate away (or are already on "Preview & Export"), you see nothing — no spinner, no status, no indication anything is happening. Also, status messages still reference "GPT-5" even though we switched to Gemini.

## Changes

### 1. Move progress indicator to a global position (above tabs)
In `AdDirectorContent.tsx`: When `analyzing` is true, render a prominent progress bar + status text **above the workflow tabs** so it's visible regardless of which step is active. This replaces the tab-specific indicator.

### 2. Add step-based progress tracking
Replace the static 60% pulse bar with actual step tracking:
- Step 1/4: "Analyzing script structure..." (0-25%)
- Step 2/4: "Writing cinematic prompts..." (25-50%)
- Step 3/4: "Scoring prompt quality..." (50-75%)
- Step 4/4: "Auto-improving weak prompts..." (75-95%)
- Done: 100%

Add an `analysisProgress` number state alongside `analysisStatus`.

### 3. Fix model labels in status messages
Update the `handleAnalyze` function status strings from "GPT-5 analyzing..." to "Analyzing script structure..." (model-agnostic, since the model may change).

### 4. Keep the ScriptInput progress card as secondary
Remove the progress card from `ScriptInput.tsx` (lines 189-202) since the global one handles it.

## Files Modified
- `src/components/ad-director/AdDirectorContent.tsx` — add global progress bar above tabs, add `analysisProgress` state, update status messages
- `src/components/ad-director/ScriptInput.tsx` — remove the local progress card (lines 189-202)

