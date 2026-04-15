

## Plan: Add Dynamic Unit Labels to AI Extract Table Headers

### Problem
The AI Extract table shows "LENGTH" and dimension columns (A, B, C…) without any unit indicator. The user wants the source unit displayed in the headers so it's immediately clear what unit the values are in.

### Changes — Single File: `src/components/office/AIExtractView.tsx`

**1. LENGTH column header** (line 2249-2251) — append the active display unit:
```
LENGTH → LENGTH (mm) / LENGTH (in) / LENGTH (ft-in)
```
Uses existing `lengthUnitLabelByMode(displayUnit)`.

**2. Dimension column headers** (line 2253) — same treatment:
```
A → A (mm) / A (in) / A (ft-in)
```

### What does NOT change
- Display logic, unit toggle, source text preservation, edit mode, bin-packing — all unchanged.
- Only two lines of JSX are updated.

