# Dual-Path Cut Math — Approved

Proceeding with implementation per `.lovable/plan.md`:

1. cutMath modules + tests (already created)
2. Add `unit_system` to `StationItem` in `useStationData.ts`
3. Wire dispatcher into `foremanBrain.ts` + update tests
4. Make `CutterStationView.tsx` and `CutEngine.tsx` unit-aware (imperial stock options 240"/480"/720", metric 6M/12M/18M)
5. Route `cutLengthDisplay.ts` numeric fallback through `formatLength`
6. Manual smoke on `/shopfloor/station/...` — verify 8' on 40' stock = 5 pcs/bar

No DB rename. `cut_length_mm` column stays; values interpreted via row's `unit_system`.