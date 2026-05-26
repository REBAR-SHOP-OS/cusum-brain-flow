# Plan: Batch A + Batch B

Executed sequentially. Each batch is verified before moving to the next. No unrelated edits.

---

## Batch A — Fix horizontal-overflow wrap in `applyArchitectureLayout`

**Failing test:** `src/lib/architectureFlow.test.ts` → "wraps overflow into additional sub-columns with increasing X" (15 nodes, expects `ai-14.x > ai-0.x`).

**Root cause:** `ARCHITECTURE_LAYOUT.maxPerColumn = 50` → 15 nodes fit in one column → same X → test fails. The wrap logic itself is correct; the threshold makes it unreachable in the test.

**Fix (surgical):**
- Lower `maxPerColumn` from `50` to `12` in `src/lib/architectureFlow.ts`. This:
  - Makes the documented wrap behavior actually trigger at realistic densities.
  - Keeps the architecture canvas readable (no 50-tall columns).
  - Passes the existing test without modifying the test.
- No other change to layout math.

**Verify:**
- `bunx vitest run src/lib/architectureFlow.test.ts` → all 4 cases green.
- Re-read `src/lib/architectureFlow.ts` — confirm only the constant changed.
- Visual: `/home` route already renders the graph; spot-check no regression.

**Dead code sweep:** none introduced (single constant change). Confirm via `rg "maxPerColumn"` → only the definition + the two usages already in this file.

**Regression test:** the existing test in `architectureFlow.test.ts` IS the regression test (already covers the wrap case). Mark DoD item satisfied — no new test needed.

---

## Batch B — Remove `React.lazy` from tab pages (HARD rule: `mem://rules/frontend-development-standards`)

**Files:**
- `src/pages/AccountingWorkspace.tsx` — 44 `lazy()` calls, tab-routed.
- `src/pages/PipelineIntelligence.tsx` — 15 `lazy()` calls, 32 `<Tabs*>` refs.

**Why HARD:** lazy tab children dispatch-crash on re-mount under React 18 concurrent rendering; rule forbids `React.lazy` in tab files.

**Fix (surgical, per file):**
1. Replace every `const X = lazy(() => import("…/X"))` with a top-level `import X from "…/X"` (or named import matching the module's export shape — verified per file before edit).
2. Delete the surrounding `<Suspense fallback=…>` wrappers that exist solely to gate the lazy children. Keep any `<Suspense>` that wraps non-lazy async (none expected; will confirm).
3. Remove `lazy` and `Suspense` from the React import line if no longer used.
4. Do NOT touch routing, tab keys, props, state, data fetching, or styling.

**Verify per file:**
- `bunx tsc --noEmit` → 0 new errors.
- `rg "lazy\(" src/pages/AccountingWorkspace.tsx src/pages/PipelineIntelligence.tsx` → 0 hits.
- `rg "Suspense" src/pages/AccountingWorkspace.tsx src/pages/PipelineIntelligence.tsx` → 0 hits (or justified remainder).
- Preview: open `/accounting` and `/pipeline-intelligence` (or whatever the actual routes are — confirmed during build), click through every tab, no blank screens, no console errors.

**Dead code sweep:**
- Drop unused `lazy`, `Suspense` imports.
- Drop any `LoadingFallback` / skeleton component that was only referenced inside the deleted `<Suspense fallback>` (verify via `rg`).
- Re-read both files end-to-end before declaring done.

**Regression test:** add `tests/regression/frontend/no-lazy-in-tab-pages.test.ts` — scans `src/pages/*.tsx` containing `<Tabs` and asserts no `lazy(` or `React.lazy`. Prevents reintroduction in any tab page, not just these two.

---

## HARD-rule compliance checklist (applied to both batches)

- Surgical Execution — only the listed files touched.
- Post-Change Verification — `vitest` + `tsc` + preview click-through.
- Dead Code Removal — unused imports/fallbacks/duplicates deleted same change; verified via `rg` + re-read.
- Bugfix DoD — repro test green, regression test added (Batch B), old code path removed (no lazy twin left behind).
- No touching `client.ts`, `types.ts`, `.env`, RLS migrations, edge functions.

## Risks

- Batch B increases initial bundle for `/accounting` and `/pipeline-intelligence`. Acceptable per HARD rule (correctness > bundle size for tab pages). If chunk size becomes a concern later, address via route-level code splitting in `App.tsx`, not per-tab lazy.
- If a tab child module has side-effects on import (unlikely), unmasking them could surface latent bugs. Will catch during preview click-through.

## Out of scope (deferred to later batches)

- C (unused exports), D (`getUser` → hook), E (RLS predicates), F (linter warnings), G (debug logs).
