

# Shape Code Audit Across App

## Data Flow Summary

Shape codes flow through the app in this pipeline:

```text
PDF Upload → AI Extract → extract_rows table → manage-extract mapping → cut_plan_items / production_tasks → Shop Floor UI
```

## Shape Code Storage Locations

| Table / Field | Format Examples | Notes |
|---|---|---|
| `extract_rows.shape_type` | Raw AI output: "17", "S1", "T2", "STRAIGHT" | Unmapped raw value |
| `extract_rows.shape_code_mapped` | After mapping: "17", "S1", "T2", "STRAIGHT" | Mapped via `manage-extract` |
| `cut_plan_items.asa_shape_code` | "17", "S1", "STRAIGHT", null | From `shape_code_mapped` |
| `production_tasks.asa_shape_code` | Same as cut_plan_items | Copied during task creation |
| `custom_shape_schematics.shape_code` | "TYPE 1", "TYPE S1", "TYPE T2", "STRAIGHT" | Prefixed with "TYPE " |

## Components Using Shape Codes (7 files)

| Component | How it receives shape code | How it looks up image |
|---|---|---|
| `AsaShapeDiagram` | `shapeCode` prop (e.g. "17") | `useShapeSchematics().getShapeImageUrl()` + fallback SVG paths |
| `BenderStationView` | `currentItem.asa_shape_code` | Passes to `AsaShapeDiagram` |
| `CutterStationView` | `currentItem.asa_shape_code` | Passes to `AsaShapeDiagram` |
| `ProductionCard` | `item.asa_shape_code` | Both `getShapeImageUrl()` directly AND `AsaShapeDiagram` fallback |
| `TagsExportView` | `row.shape_code_mapped \|\| row.shape_type` | `getShapeImageUrl()` for card images; also builds `TYPE-{shapeType}.PNG` string for CSV |
| `DetailedListView` | `item.asa_shape_code` | Display only (badge text), no image lookup |
| `OptimizationView` | `r.shape_code_mapped \|\| r.shape_type` | Pass-through only |

## Lookup Logic in `useShapeSchematics`

The hook builds a map from `custom_shape_schematics` rows. For each row like `{shape_code: "TYPE 17", image_url: "TYPE_17_xxx.png"}`, it stores:
- `"TYPE 17"` → URL
- `"17"` → URL (strips "TYPE " prefix)

When looking up, `getShapeImageUrl("17")` tries:
1. Direct: `"17"` — matches the stripped key
2. With prefix: `"TYPE 17"` — matches the original key

This means lookups work for codes like "17", "S1", "T2", "STRAIGHT", "007".

## Issues Found

### 1. Redundant double-lookup in `ProductionCard`
`ProductionCard` calls `getShapeImageUrl()` at line 38 AND passes to `AsaShapeDiagram` which calls it again internally. This causes two identical fetches from the same hook (69 rows each). Not a bug but wasteful — every `ProductionCard` instance triggers its own `useShapeSchematics` hook fetch.

### 2. `useShapeSchematics` has no caching — N+1 fetch problem
Every component that calls `useShapeSchematics()` triggers a fresh `SELECT * FROM custom_shape_schematics`. On the shop floor page, this fires multiple times (once per `ProductionCard` + once per `AsaShapeDiagram` inside each card + station views). Network logs confirm duplicate fetches.

### 3. Built-in SVG `SHAPE_PATHS` are now redundant
`AsaShapeDiagram` has hardcoded SVG paths for shapes "1", "3", "5", "11", "17", "21", "31", "33", "41", "51". But now all 69 shapes have uploaded schematics in the database. The SVG fallback paths will never render for these codes (the custom image takes priority). They serve as a dead-code safety net.

### 4. `TagsExportView` builds `TYPE-{shapeType}.PNG` string for CSV/picture column
This is a legacy reference string, not an actual URL. It doesn't use the public bucket URL. If consumers of the CSV expect a real image path, this is broken.

### 5. No `onError` fallback on `<img>` tags
If a shape image fails to load (404, bucket issue), the `<img>` just shows a broken image icon. No fallback to the SVG path or placeholder.

## Recommended Fixes

### Fix 1: Add React Query caching for shape schematics
Wrap the `custom_shape_schematics` fetch in a shared React Query hook so all components share one cached copy. Eliminates duplicate network requests.

### Fix 2: Add `onError` fallback to all shape `<img>` tags
In `AsaShapeDiagram` and `ProductionCard`, add `onError` handler that hides the broken image and shows the SVG fallback or a placeholder circle.

### Fix 3: Remove redundant `getShapeImageUrl` call from `ProductionCard`
Since `AsaShapeDiagram` already does the lookup internally, `ProductionCard` doesn't need its own call. Simplify to just pass the shape code to `AsaShapeDiagram`.

### Fix 4: Fix CSV picture column in `TagsExportView`
Update the `TYPE-{shapeType}.PNG` string to use the actual public bucket URL from `getShapeImageUrl()`, or document it as a label-only reference.

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useShapeSchematics.ts` | Wrap in React Query for shared caching |
| `src/components/shopfloor/AsaShapeDiagram.tsx` | Add `onError` fallback on `<img>` |
| `src/components/shopfloor/ProductionCard.tsx` | Remove redundant `useShapeSchematics` call |
| `src/components/office/TagsExportView.tsx` | Fix picture column to use real URLs |

