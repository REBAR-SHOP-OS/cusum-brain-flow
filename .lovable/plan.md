## Problem

In `src/components/shopfloor/BendingSchematic.tsx`, every dimension value renders with a hardcoded `mm` suffix (line 38). When the work order / card is displayed in inches (e.g. `A=8`, `B=24` shown above the schematic), the dimension list still says `8 mm` / `24 mm`, which contradicts the rest of the card.

## Fix

Drive the unit suffix from the same source the rest of the app uses for cut lengths: `useUnitSystem()` from `src/lib/unitSystem.ts` (returns `"metric"` or `"imperial"`).

### Changes (frontend only, additive)

1. `src/components/shopfloor/BendingSchematic.tsx`
   - Import `useUnitSystem` and `lengthUnit` from `@/lib/unitSystem`.
   - Compute `const unitSystem = useUnitSystem();` and `const unitLabel = lengthUnit(unitSystem);` (yields `"in"` for imperial, `"mm"` for metric — same convention used in `AddItemForm.tsx`).
   - Replace the hardcoded `<span>...mm</span>` on line 38 with `<span>...{unitLabel}</span>`.

2. No DB changes, no changes to `BenderStationView.tsx`, no changes to other stations. Values themselves are not converted — only the displayed unit label is corrected to match the card's unit system, which is consistent with how `BAR SIZE`, schematic badges (`A=8`, `B=24`), and `formatLength` already render across the app.

### Out of scope

- Cutter station / other stations: only touch if they show the same hardcoded `mm`. A quick `rg "mm</span>"` after this change can confirm — left as a follow-up only if found.
- Per-mark unit override (a card-level stored unit). Current architecture uses company-wide `unit_system`; honoring that is enough to match the user's screenshot.
