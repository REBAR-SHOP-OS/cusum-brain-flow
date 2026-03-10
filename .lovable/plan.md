

# Remove Dedupe as Pipeline Blocker — Make Advisory Only

## Problem
Dedupe blocks the pipeline between extraction and mapping. It traps sessions, delays mapping, and interferes with barlist processing.

## New Pipeline Order

```text
BEFORE: Uploaded → Extracting → Strategy → Dedupe → Mapped → Validated → Optimized → Approved
AFTER:  Uploaded → Extracting → Strategy → Mapped → Validated → Optimized → Approved
                                    └── (advisory dedupe scan runs in background)
```

## Changes

### 1. `AIExtractView.tsx` — Pipeline steps & flow logic

**PIPELINE_STEPS** (line 60-69): Remove the `extracted`/Dedupe step. New order:
- uploaded → extracting → strategy → mapping → validated → optimizing → approved

**getStepIndex** (line 71-78): Remove `dedupeStatus` parameter. Strategy still gates on `!optimizationMode`. Status `extracted` with mode set maps to `mapping` step.

**Extraction handler** (lines 407-433): Remove the synchronous dedupe scan block. Instead, fire dedupe as background (non-blocking) after extraction completes — store result in state but don't block flow. Set `dedupe_status = "complete"` immediately so it never blocks.

**Action bar** (lines 1310-1314): Remove `dedupeResolved` guard from "Apply Mapping" button. Show mapping button when `currentStepIndex` is at the mapping step, regardless of dedupe state.

**Dedupe UI** (lines 1491-1533): Replace hard-blocking dedupe cards with an advisory warning card:
- Shows "⚠ N possible duplicates found" with Review / Merge / Dismiss buttons
- Visible at mapping step and downstream — does not block any action
- If no duplicates, card is hidden entirely

**Mapping panel gate** (line 1535): Remove `dedupeResolved` from the condition. Show mapping panel when status is `extracted` (with optimization_mode set) or `mapping`.

### 2. `extractService.ts` — No changes to extract/mapping/validation logic
Keep `detectDuplicates`, `handleConfirmMerge`, `handleSkipDedupe` functions intact — they become manual-only triggers.

### 3. Merge safety preserved
- `handleConfirmMerge` still calls `detectDuplicates(sid, false)`, logs `duplicate_merged` event, updates `dedupe_status = "merged"`
- `handleSkipDedupe` still sets `dedupe_status = "skipped"`
- Warning badge persists downstream when dedupe was skipped

### Summary of touched areas (single file)

| Area | Change |
|------|--------|
| `PIPELINE_STEPS` | Remove Dedupe step |
| `getStepIndex` | Drop dedupeStatus param, map extracted→mapping |
| Extraction handler | Fire dedupe async, don't await/block |
| Action bar | Remove `dedupeResolved` guard on Apply Mapping |
| Dedupe UI cards | Convert to advisory-only warning card |
| Mapping panel gate | Remove `dedupeResolved` condition |

**Files changed**: `src/components/office/AIExtractView.tsx` only.

