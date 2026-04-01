
Goal: make inch-based files (values like `48"`) auto-detect as inches so the UI shows inches instead of mm.

1) Fix unit-system default and comparisons in extraction
- File: `supabase/functions/extract-manifest/index.ts`
- Change default from `detectedUnitSystem = "metric"` to `detectedUnitSystem = "mm"`.
- Update follow-up checks that currently use `detectedUnitSystem === "metric"` to `=== "mm"` so the fallback detectors still run.

2) Detect units from raw extracted values before numeric normalization
- Current issue: unit detection runs after `parseDimension(...)`, which strips inch markers and turns `48"` into `48`, making imperial detection miss.
- Capture a `rawItems` snapshot from AI output before conversion.
- Run imperial regex checks against raw strings from `rawItems` (including `total_length`, `A..H`, etc.).
- Then run the existing numeric normalization pass (`parseDimension`) afterward.

3) Keep spreadsheet fallback detection, plus tighten for inch-mark formats
- Keep XLSX raw-cell and number-format (`cell.z`) checks as secondary/tertiary detectors.
- Ensure these checks run when unit is still `"mm"` and recognize straight inch notation (`48"`), feet-inch (`6'-4"`), and feet-only (`5'`).

4) Frontend compatibility guard for already-saved legacy sessions
- File: `src/components/office/AIExtractView.tsx`
- Add a small fallback mapping so if a session still has legacy `"metric"` value, it is treated as `"mm"` for display state.
- This prevents ambiguous labels and keeps pipeline badge consistent.

Validation plan
- Re-extract with an inch-based file containing values like `48"`, `72"`, `6'-0"`.
- Confirm pipeline badge shows inches (not mm), and mapping/apply converts correctly to stored mm via existing `apply-mapping` logic.
- Re-test a true mm file to confirm no regression.

Technical details
- Root cause is ordering + sentinel mismatch:
  - Ordering bug: unit detection after normalization loses inch symbols.
  - Sentinel bug: backend uses `"metric"` while extraction/mapping flow expects concrete source units (`"mm" | "in" | "ft" | "imperial"`).
- Scope: 2 files (`extract-manifest/index.ts`, `AIExtractView.tsx`), no schema changes, no migration required.
