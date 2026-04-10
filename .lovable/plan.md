

# Remove Unit Label from LENGTH Column Header

## Problem
The LENGTH column header shows `LENGTH (mm)` — the user wants it to just say `LENGTH` with no unit suffix.

## Change

### `src/components/office/AIExtractView.tsx` — line 2199
Change:
```
LENGTH ({lengthUnitLabelByMode(displayUnit as LengthDisplayMode)})
```
To:
```
LENGTH
```

One line, one file.

