

# Unit System Audit — Remaining Issues

## Issues Found

### Issue 1: Line Items Table Header Uses Wrong Variable (HIGH)
**Line 2130** in `AIExtractView.tsx`:
```
LENGTH ({lengthUnitLabelByMode(selectedUnitSystem as LengthDisplayMode)})
```
Uses `selectedUnitSystem` (source/mapping unit) instead of `displayUnit`. When user toggles display to "in", header still shows the mapping unit label.

**Fix**: Change to `displayUnit`.

### Issue 2: Merged Rows Table Uses `selectedUnitSystem` for Display (MEDIUM)
**Line 2004** in `AIExtractView.tsx`:
```
formatLengthByMode(row.total_length_mm, selectedUnitSystem as LengthDisplayMode)
```
The merged/dedupe preview table formats lengths using the source unit instead of the display unit.

**Fix**: Change to `displayUnit`.

### Issue 3: ZPL Label Hardcodes "LENGTH (mm)" (MEDIUM)
**Line 79** in `generateZpl.ts`:
```
^FO310,205^FDLENGTH (mm):^FS
```
Always prints "LENGTH (mm)" on Zebra labels regardless of unit system. Also, line 43 outputs raw mm value without conversion.

**Fix**: Accept a `unitSystem` parameter in `generateZpl()`. Format length values and label based on the unit. Pass `sessionUnitToDisplay()` from `TagsExportView`.

### Issue 4: ZPL Dims Output Raw mm Values (MEDIUM)
**Line 29** in `generateZpl.ts`:
```
const text = chunk.map((d) => `${d}:${dims[d]}`).join("  ");
```
Always outputs raw mm dimension values, no conversion for imperial.

**Fix**: Apply formatting based on passed unit system.

---

## Proposed Changes

### File 1: `src/components/office/AIExtractView.tsx`
- **Line 2130**: `selectedUnitSystem` → `displayUnit`
- **Line 2004**: `selectedUnitSystem` → `displayUnit`

### File 2: `src/utils/generateZpl.ts`
- Add `unitSystem` parameter to `generateZpl()`
- Format length and dims using `sessionUnitToDisplay` mapping
- Update label text from hardcoded "LENGTH (mm)" to dynamic

### File 3: `src/components/office/TagsExportView.tsx`
- Pass `sessionUnitToDisplay(selectedSession?.unit_system)` to `generateZpl()`

