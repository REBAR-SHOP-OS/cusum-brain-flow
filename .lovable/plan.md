
# Re-run 20 York Takeoff with Walden Shop Drawings

## What's Happening

The existing "20 york" estimation project has 0 extracted items because the previous takeoff failed (bucket/pipeline issues we already fixed). The user has now uploaded the **actual shop drawing markups** from Walden (SD24-SD31 and SD01-SD04) which contain dense, precise rebar callouts -- exactly the kind of drawings the AI can extract from.

## ERP Context Found

| Entity | Details |
|--------|---------|
| Estimation Project | "20 york" (id: f4eb4228) -- draft, 0 items |
| Customer | WALDEN DESIGN BUILD INC. (id: 26ea9d67) |
| Lead (Cabana) | "FW: cabana 20 york Walden Homes Seperate" -- stage: won |
| Lead (Main) | "S00128, RFP-2196 - reinforcement steel bars for 20 York Valley Cres." -- stage: shop_drawing_approval |
| Existing Files | 2 PDFs already in storage (Structural + Architectural) |

## Plan

### Step 1: Upload the 2 Walden Markup PDFs to Storage

Copy the user-uploaded files into the project so they can be uploaded to the estimation-files bucket. The TakeoffWizard handles uploading to storage automatically, but we need to make these files available.

### Step 2: Delete the Failed "20 york" Project

The existing project has 0 items and status "draft" -- it's a failed run. Delete it so the user can re-run cleanly with the correct shop drawings.

**SQL:**
```sql
DELETE FROM estimation_items WHERE project_id = 'f4eb4228-f0ed-4d77-9ae2-9bb263968899';
DELETE FROM estimation_projects WHERE id = 'f4eb4228-f0ed-4d77-9ae2-9bb263968899';
```

### Step 3: Link Estimation to ERP Entities

Update `TakeoffWizard.tsx` to allow linking a takeoff to an existing **lead** and **customer** from the pipeline. Add optional dropdowns for:
- Customer selector (pre-populated from `customers` table)
- Lead selector (filtered by customer)

This connects the estimation back to the pipeline so "20 York Valley" lead and "WALDEN DESIGN BUILD INC." customer are properly linked.

### Step 4: Improve the Gemini Prompt for Shop Drawings

The uploaded Walden drawings use a specific notation style:
- `2x11 15M LS100 @12" BLL & TUL` -- means 2 layers x 11 bars, 15M size, mark LS100, at 12" spacing, Bottom Long-way Lower & Top Upper-way Lower
- `3 20M AS57 T&B` -- 3 bars, 20M, mark AS57, Top & Bottom
- `4x2 15M A1502 U-BAR EW` -- 4 sets of 2 bars, U-bar shape

Update the Gemini prompt in `ai-estimate/index.ts` to:
- Recognize Canadian rebar shop drawing notation (LS, AS, A-prefix marks)
- Parse layer multipliers (e.g., "2x11" = 22 bars total)
- Understand position codes: BLL (Bottom Long-way Lower), TUL (Top Upper-way Lower), SF EF (Start Face End Face), T&B (Top & Bottom), D&E DWL (Dowel)
- Extract spacing from "@12" notation and convert to mm (12" = 305mm)
- Identify shape codes: straight, U-bar, stirrup, dowel
- Return more accurate `cut_length_mm` by inferring from element dimensions when not explicitly stated

### Step 5: Increase Gemini Token Limit

These shop drawings are very dense (8+ pages of detailed callouts). Increase `maxOutputTokens` from 16,000 to **32,000** to ensure all items are captured. Also consider processing each page separately and merging results for better accuracy.

### Step 6: PDF Rendering for Annotation Viewer

The `AnnotatedDrawingViewer` currently tries to render source files as `<img>` tags. PDFs won't render this way. Add PDF.js rendering:
- Install `pdfjs-dist` or use a CDN-loaded PDF.js worker
- For each PDF source file, render each page to a canvas, then convert to an image URL
- Cache the rendered page images so zoom/pan remains smooth
- Map `page_index` from items to the correct rendered page

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/ai-estimate/index.ts` | Enhanced Gemini prompt for Canadian shop drawing notation, increase token limit to 32K, per-page processing option |
| `src/components/estimation/TakeoffWizard.tsx` | Add customer/lead selectors, pass IDs to ai-estimate |
| `src/components/estimation/AnnotatedDrawingViewer.tsx` | Add PDF.js rendering for PDF source files instead of raw img tag |
| Database cleanup | Delete failed "20 york" project |

## Technical Notes

- The Walden markup PDFs are multi-page (SD24-SD31 = ~8 pages, SD01-SD04 = ~4 pages) with hundreds of individual bar callouts
- Gemini 2.5 Pro handles multi-page PDFs natively via inline_data with `application/pdf` MIME type
- The base64 encoding of large PDFs (potentially 5-15MB each) may hit Gemini's inline data limits; if so, we'll use the File API to upload first
- bbox coordinates from Gemini on PDF pages will map to specific page indices, which the annotation viewer needs to handle per-page
- The pricing table already has 6 active rows (10M-35M) so cost calculations will work
