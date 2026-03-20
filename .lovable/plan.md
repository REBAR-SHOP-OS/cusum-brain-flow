
Title: Root Fix for ft-in Display in the Marked Extract Table

Objective:
Make the marked “5 LINE ITEMS” section render every numeric length/dimension value in ft-in whenever Imperial (ft-in) is the active source/display unit, with no fallback to stale mm state.

What I found:
- The table rendering in `AIExtractView.tsx` already supports ft-in formatting, but it only works when `selectedUnitSystem === "imperial"`.
- The real failure is state consistency: the UI has multiple unit sources (`selectedUnitSystem`, `activeSession.unit_system`, mapping-panel local unit), and stale session data can still leave the main results table in mm.
- The mapping preview and the results table are not using one shared “effective unit” decision path, so one part of the screen can show ft-in while the marked table still shows mm.
- The backend does persist/apply units during mapping, but the frontend still needs a stricter single-source-of-truth flow for display.

Implementation plan:
1. Create one effective display-unit resolver in `AIExtractView.tsx`
   - Derive a single `effectiveUnitSystem` used by the entire extract screen.
   - Priority order:
     1) explicit user-selected unit in current session
     2) unit returned/persisted on the active extract session
     3) default `mm`
   - Remove direct per-cell checks against mixed unit sources.

2. Refactor the marked table to use the effective unit everywhere
   - In the “5 LINE ITEMS” table, route:
     - `total_length_mm`
     - every dim column (`A, B, C, D, E, F, G, H, J, K, O, R`)
     through one shared formatter.
   - When `effectiveUnitSystem === "imperial"`, every numeric cell must render as ft-in.
   - Update the table header so the marked area clearly shows ft-in when active.

3. Apply the same unit resolver to all related extract views on the same screen
   - Merged rows inspector
   - Any preview/result table on the extract page that shows the same row measurements
   - Pipeline chip label
   This prevents the user seeing ft-in in one area and mm in another.

4. Tighten the unit state lifecycle in `AIExtractView.tsx`
   - On manual unit selection/confirmation: immediately lock the chosen unit into screen state.
   - On apply mapping: keep that unit as authoritative until the refreshed session confirms the same value.
   - On session load/history reopen: restore the saved session unit into the same display state path.
   - Prevent stale realtime/session refreshes from overwriting an explicit user choice during the same flow.

5. Keep backend persistence aligned
   - Verify `applyMapping(sessionId, unitSystem)` remains the only mapping apply entry point.
   - Trust the server-applied `unit_system` after refresh, but do not let stale data override the current manual choice before that refresh completes.
   - If needed, use the returned `unit_system` from `manage-extract` as the immediate post-apply source of truth.

Files to update:
- `src/components/office/AIExtractView.tsx`
  - add one effective unit resolver
  - use one shared ft-in/mm formatter for all displayed measurement cells
  - remove mixed unit checks from the marked table and related inspectors
  - stabilize state sync between user selection and session refresh
- `src/lib/extractService.ts`
  - confirm apply-mapping call continues passing the exact unit
- `supabase/functions/manage-extract/index.ts`
  - verify returned `unit_system` is the effective applied unit and keep it consistent with frontend expectations

Technical details:
- Stored DB values should continue to be treated as mm after mapping is applied.
- ft-in display must always be formatting-from-mm, never assuming stored values are already inches.
- Dimension sequence must remain `A, B, C, D, E, F, G, H, J, K, O, R` and continue skipping `I`.
- The fix should use one formatter path, not repeated inline conditional formatting.

Acceptance criteria:
- In the marked “5 LINE ITEMS” section, all numeric measurements show as ft-in when Imperial (ft-in) is active.
- No measurement in that section remains as raw mm while Imperial is active.
- Reopening a saved session with imperial selected restores ft-in in the same section automatically.
- Changing the unit and re-applying mapping updates the full section consistently, not partially.
- The mapping preview, pipeline label, and extract results no longer disagree on the active unit.
