

# Fix: Mapping Completion Not Advancing to Validated

## Root Cause

The deployed edge function still writes `status: "mapping"` despite the source code showing `"mapped"`. The pipeline has a step with key `"mapping"` at index 3, so `getStepIndex("mapping")` returns 3 — keeping the user permanently stuck on "Mapped" with the Apply Mapping button visible.

The client-side safety net (`supabase.update({ status: "mapped" })`) exists but uses `as any` cast and may be silently failing. Even if it succeeds, the `refreshSessions()` call may return before the DB write propagates.

## Fix (3 changes)

### 1. Redeploy edge function (`manage-extract`)
Source already has `status: "mapped"` on line 393. Redeploying ensures the live function writes the correct status.

### 2. Make client safety net bulletproof (`AIExtractView.tsx`, `handleApplyMapping`)
- Remove `as any` cast — use proper typing
- Log the update result to catch silent failures  
- After the DB update, check the result and error-handle
- Add `getStepIndex` fallback: if status is still `"mapping"` after refresh, treat it as `"mapped"` in `getStepIndex`

### 3. Add legacy `"mapping"` → `"mapped"` fallback in `getStepIndex`
Add: `if (status === "mapping") return PIPELINE_STEPS.findIndex(s => s.key === "validated");`

This ensures that even if legacy sessions or stale edge function writes leave `"mapping"` in the DB, the UI still advances to Validated.

### 4. Update Action Bar to show "Mapping Complete" when status is mapped/mapping-done
Change the `currentStepIndex === 3` guard on the Apply Mapping button to also check if mapping was already applied (status is "mapped" or step resolved to 4). Show a "Mapping Complete" badge instead.

## Files Changed
- `supabase/functions/manage-extract/index.ts` — redeploy only (no source change)
- `src/components/office/AIExtractView.tsx` — `getStepIndex` legacy fallback + action bar UI

## Exact State Rules
- `mapping` status → maps to validated step (index 4) via `getStepIndex` fallback
- `mapped` status → maps to validated step (index 4) — already works
- Apply Mapping button: hidden when `currentStepIndex >= 4`
- "Mapping Complete" badge shown when step advanced past mapping

