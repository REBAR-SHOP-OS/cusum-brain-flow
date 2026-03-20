

## Fix: Show Detected Source Unit in Pipeline "Uploaded" Step

### Problem

The user wants the first pipeline chip ("Uploaded") to display the detected/selected source unit system so it's immediately visible at the top of the view. Currently the "Uploaded" label is static and gives no indication of the unit system being used.

### Root Cause

`PIPELINE_STEPS` is a static constant array (line 104-111). The "uploaded" step always renders as "Uploaded" with no dynamic content. The `selectedUnitSystem` / `activeSession.unit_system` value is never reflected in the pipeline header.

### Changes

**File: `src/components/office/AIExtractView.tsx`**

1. **Make the "Uploaded" step label dynamic**: In the pipeline rendering block (lines 987-1009), when `step.key === "uploaded"` and a unit system is set (either from `selectedUnitSystem` or `activeSession.unit_system`), append the unit label to the chip:
   - `"mm"` → `"Uploaded · mm"`
   - `"in"` → `"Uploaded · Inches"`
   - `"ft"` → `"Uploaded · Feet"`
   - `"imperial"` → `"Uploaded · ft-in"`

2. **Implementation**: Add a unit label map constant and modify the `{step.label}` render in the pipeline to conditionally append the unit suffix when `step.key === "uploaded"` and a unit is known.

This is a display-only change — no backend or data flow modifications needed.

### Files
- `src/components/office/AIExtractView.tsx` — dynamic label for "Uploaded" pipeline chip

