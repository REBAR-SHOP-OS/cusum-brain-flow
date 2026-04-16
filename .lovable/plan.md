

## Plan: Fix "Stored as mm" Label

### Problem
The mapping preview label still says `"(source: in → stored as mm)"` — this is a leftover from before the source-unit preservation change. The actual storage already keeps values in their source unit (no mm conversion). Only the **label text** is wrong.

### Change

**`src/components/office/BarlistMappingPanel.tsx` line 337**

Change:
```
(source: {unitLabel} → stored as mm)
```
To:
```
(source: {unitLabel} → stored as {unitLabel})
```

This is a one-line text fix. No logic changes needed — storage is already correct.

