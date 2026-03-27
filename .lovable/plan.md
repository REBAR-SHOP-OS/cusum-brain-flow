

# Fix: Straight Bars Showing "No shape"

## Problem
Items with no `shape_code` (NULL) show "No shape" instead of defaulting to the STRAIGHT schematic. The database has a "STRAIGHT" entry in `custom_shape_schematics` with an uploaded image, but items with NULL shape codes never look it up.

## Solution
In `TagsExportView.tsx`, when computing `shapeType` for each row, default NULL/empty shape codes to `"STRAIGHT"`. This way the lookup `getShapeImageUrl("STRAIGHT")` will find and display the correct schematic.

## File: `src/components/office/TagsExportView.tsx`

Around line 453 where `shapeType` is computed, change:
```ts
const shapeType = r.shape_code_mapped || r.shape_type || "";
```
to:
```ts
const shapeType = r.shape_code_mapped || r.shape_type || "STRAIGHT";
```

This ensures all items without an explicit shape code default to the STRAIGHT schematic image.

## File Changed
- `src/components/office/TagsExportView.tsx` — default empty shape to "STRAIGHT"

