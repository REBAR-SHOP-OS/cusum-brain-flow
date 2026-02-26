

## Plan: Add "Optimize" Step Between Validated and Approved

### What Changes

**1. Add "optimizing" step to the pipeline (`src/components/office/AIExtractView.tsx`)**
- Add `{ key: "optimizing", label: "Optimized", icon: Zap }` to `PIPELINE_STEPS` between "validated" and "approved" (index 5, pushing approved to index 6)
- Update action bar logic: when `currentStepIndex >= 4` (validated), show an "Optimize" button that sets session status to "optimizing"
- When status is "optimizing" (`currentStepIndex === 5`), render an inline optimization panel (stock length, kerf, mode selection from OptimizationView) with an "Apply & Continue" button
- After applying optimization, update session status to "optimizing" (complete) and show the Approve button at `currentStepIndex >= 5`

**2. Inline optimization panel in AIExtractView**
- Import `runOptimization`, `CutItem`, `OptimizationSummary`, `OptimizerConfig` from `@/lib/cutOptimizer`
- When session status is "optimizing", show:
  - Stock length selector (6M, 12M, 18M)
  - Kerf input
  - Three plan cards (Standard, Optimized, Best Fit) — reuse the comparison logic from OptimizationView
  - "Select & Approve" button that saves the optimization snapshot, then calls `handleApprove`

**3. Update action bar flow**
- Step index 4 (validated) + no blockers → show "Optimize" button (instead of directly showing Approve)
- Step index 5 (optimizing) + plan selected → show "Approve & Create WO"
- The "Optimize" button sets session status to "optimizing" via direct Supabase update

**4. Update session status in DB**
- Add a handler `handleStartOptimize` that updates `extract_sessions.status` to `"optimizing"` 
- No DB migration needed — the status column is a text field, not an enum

### Files Modified
- `src/components/office/AIExtractView.tsx` — add pipeline step, inline optimizer UI, update action bar logic

