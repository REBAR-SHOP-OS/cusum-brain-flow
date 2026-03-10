

# Remove "Optimized" Stage — Surgical Patch

## Current Pipeline
`uploaded → extracting → strategy → mapping → validated → optimizing → approved`

## Target Pipeline
`uploaded → extracting → strategy → mapped → validated → approved`

The "optimizing" step currently shows a local cut-plan comparison panel after validation. This will be merged into the validated step — the optimization panel renders at validated, and Approve becomes directly available.

## Changes (single file: `src/components/office/AIExtractView.tsx`)

### 1. Remove `optimizing` from PIPELINE_STEPS (line 87)
Delete the `{ key: "optimizing", label: "Optimized", icon: Zap }` entry. Pipeline becomes 6 steps.

### 2. Update `getStepIndex` — legacy compatibility
Add: `if (status === "optimizing") return PIPELINE_STEPS.findIndex(s => s.key === "validated");`
Legacy sessions with "optimizing" status map to the validated step.

### 3. Merge optimization UI into validated step (lines 1341-1359)
- At `currentStepIndex === 4` (validated): show Validate button, auto-trigger optimization preview (call `handleStartOptimize` automatically after validation succeeds or show Optimize button alongside Validate)
- Remove the gate `currentStepIndex === 4 && blockerCount === 0 && !isOptimizing` — instead show Optimize at validated step
- Change `currentStepIndex >= 5 || isOptimizing` to `currentStepIndex >= 4 && isOptimizing` for the Approve button visibility

### 4. Optimization panel visibility (line 1971)
Change condition from `activeSession?.status === "optimizing" || isOptimizing` to just `isOptimizing` (since "optimizing" status no longer exists as a pipeline step, but `isOptimizing` local flag still controls panel visibility).

### 5. Remove status badge for "optimizing" (line 2124)
Remove `optimizing: { label: "OPTIMIZED", ... }` from the badge map. Add legacy fallback so old records don't crash.

### 6. Session load handler (line 642-643)
Map legacy: `setIsOptimizing(session.status === "optimizing" || session.status === "validated");` — if a session was mid-optimization, it still shows the panel.

### 7. Remove DB status write to "optimizing" (line 554-558)
In `handleStartOptimize`, remove the `update({ status: "optimizing" })` call. The session stays at "validated" while the user picks a cut plan.

## Files Changed
- `src/components/office/AIExtractView.tsx` — single file, ~15 line edits

## No changes needed to:
- Edge functions (no "optimizing" references in backend)
- `cutOptimizer.ts` (the "optimized" mode name there refers to an algorithm, not a pipeline stage)
- `OptimizationView.tsx` / `TagsExportView.tsx` (unrelated "optimized" refers to sort/algorithm modes)
- Tests (no "optimizing" pipeline references)
- Database schema

## Legacy Compatibility
- Sessions with `status = "optimizing"` will render at the validated step with optimization panel visible
- No data migration needed

## Risk
- Minimal: purely UI step removal. All optimization logic preserved, just shown at validated step instead of its own step.

