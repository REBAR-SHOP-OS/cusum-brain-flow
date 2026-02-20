

# Annotated Drawing Viewer with Color-Coded Rebar Marks

## What This Adds

Like iBeam.ai, when a takeoff completes, each extracted rebar item will have its **location on the drawing** identified by the AI, and the drawing will be displayed with **colorful bounding boxes and labels** overlaid on top. Users can click an annotation to highlight the corresponding BOM row, and vice versa.

## How It Works

### 1. AI Returns Bounding Box Coordinates (Backend Change)

**File: `supabase/functions/ai-estimate/index.ts`**

Update the Gemini prompt to also extract spatial location data for each item. Gemini vision can return normalized bounding box coordinates (0-1 range) for detected elements.

Add to the extraction prompt:
- `page_index`: which uploaded file/page (0-based)
- `bbox`: `{ x: float, y: float, w: float, h: float }` -- normalized coordinates (0.0 to 1.0) of where the rebar callout appears on the drawing

Increase `maxOutputTokens` to 16000 to accommodate the extra spatial data.

### 2. Store Annotations in Database

**Database migration** -- Add a `bbox` JSONB column to `estimation_items`:

```sql
ALTER TABLE estimation_items 
  ADD COLUMN IF NOT EXISTS bbox jsonb,
  ADD COLUMN IF NOT EXISTS page_index integer DEFAULT 0;
```

The `bbox` stores `{"x": 0.12, "y": 0.35, "w": 0.08, "h": 0.05}` and `page_index` identifies which source file the annotation belongs to.

Update the insert logic in `ai-estimate/index.ts` to persist `bbox` and `page_index`.

### 3. Drawing Viewer Component with Canvas Overlay

**New file: `src/components/estimation/AnnotatedDrawingViewer.tsx`**

A split-panel or full-width component that:
- Renders the uploaded drawing (image) in a scrollable/zoomable container
- Overlays an HTML5 Canvas (or SVG layer) on top with colored rectangles for each detected item
- Color coding by element type:
  - Footing = blue
  - Column = red  
  - Beam = green
  - Slab = orange
  - Wall = purple
  - Pier = teal
- Each annotation box shows a small label (e.g. "C1 - 20M x8") 
- Hover shows a tooltip with full item details
- Click an annotation to highlight the corresponding BOM table row
- Legend panel showing element type colors
- Zoom controls (zoom in/out, fit-to-width, pan with mouse drag)
- Page selector if multiple drawings uploaded

### 4. Update ProjectDetail to Include Annotated View

**File: `src/components/estimation/ProjectDetail.tsx`**

Replace the basic "Drawings" tab with the new `AnnotatedDrawingViewer`:
- Pass `source_files` URLs and `items` (with bbox data) as props
- Add a toggle: "Show Annotations" on/off
- Add a "Confidence" filter slider (if we add confidence scores)

Add a new tab called "Annotated Drawings" between BOM and Export.

### 5. BOM Table ↔ Drawing Sync

**File: `src/components/estimation/BOMTable.tsx`**

- Add a `highlightedItemId` prop
- When an item is hovered/selected in the BOM table, emit an event to highlight the corresponding annotation on the drawing
- When an annotation is clicked on the drawing, scroll the BOM table to that row and highlight it
- Lift the `selectedItemId` state into `ProjectDetail.tsx` to sync both components

### 6. Color Legend Component

**New file: `src/components/estimation/AnnotationLegend.tsx`**

A small sidebar/bar showing:
- Color swatch + element type name for each category
- Count of items per category
- Toggle visibility per category (show/hide footings, columns, etc.)

## Component Architecture

```
ProjectDetail
  |-- KPI Cards
  |-- Tabs
       |-- "Annotated Drawings" (NEW - default tab)
       |    |-- AnnotatedDrawingViewer
       |    |    |-- Image layer (the PDF/drawing rendered as image)
       |    |    |-- SVG overlay layer (bounding boxes + labels)
       |    |    |-- Zoom/pan controls
       |    |-- AnnotationLegend (sidebar)
       |-- "BOM Table"
       |    |-- BOMTable (with highlight sync)
       |-- "Export"
            |-- ExportPanel
```

## Technical Details

**Drawing Rendering**: For PDFs, we cannot render them inline in canvas. Instead, the edge function will convert uploaded PDFs to images (PNG) during the takeoff and store them in the same bucket. For images (PNG/JPG), display directly. The `source_files` JSONB will be updated to include `{ url, type, preview_url }` where `preview_url` is the rendered image version.

**SVG Overlay Approach**: Use an absolutely-positioned SVG element over the image. Each annotation is a `<rect>` with stroke color matching element type, plus a `<text>` label. This approach:
- Scales naturally with CSS transforms (zoom)
- Supports click/hover events natively
- Is resolution-independent
- Works better than Canvas for interactive elements

**Zoom/Pan**: Use CSS transform (scale + translate) on a wrapper div. Track zoom level (0.5x to 4x) and pan offset via mouse drag. Mouse wheel = zoom.

**For PDF files**: Since we're already sending PDFs to Gemini for extraction, add a second step that converts the first page of each PDF to a PNG using the Gemini image generation model or a lightweight approach: render the PDF URL in an `<iframe>` for preview, or use `pdf.js` (can add as dependency). The simplest approach: for image files, display directly; for PDFs, show in an `<object>` or `<iframe>` tag with the SVG overlay anchored to a known page size.

**Prompt Engineering for Accurate BBoxes**: The Gemini prompt will instruct:
- Use normalized coordinates (0.0-1.0) relative to the full page
- `x,y` = top-left corner of the rebar callout or structural element reference
- `w,h` = width and height of the bounding region
- Temperature set to 0.1 for maximum precision

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/ai-estimate/index.ts` | Add bbox + page_index to prompt and persist |
| `src/components/estimation/AnnotatedDrawingViewer.tsx` | New -- full drawing viewer with SVG overlay |
| `src/components/estimation/AnnotationLegend.tsx` | New -- color legend with category toggles |
| `src/components/estimation/ProjectDetail.tsx` | Add Annotated Drawings tab, sync state |
| `src/components/estimation/BOMTable.tsx` | Add highlight sync props |
| Database migration | Add `bbox` and `page_index` columns to `estimation_items` |
