

# AI-Driven Rebar Estimation and Detailing Module -- Implementation Plan

## Current State Assessment

The existing system already has foundational estimation capabilities:

- **Gauge agent** (`specialists.ts`): RSIC/CSA-focused prompt for rebar estimating
- **Document analysis pipeline** (`agentDocumentUtils.ts`): OCR, PDF-to-images, zone detection, basic rebar data extraction via regex
- **extract-manifest** edge function: Parses uploaded schedules (PDF/Excel/images) into structured bar-bending data using Gemini
- **shape-vision** edge function: Identifies ASA shape codes from images
- **Database tables**: `rebar_standards` (bar properties, hook/lap multipliers), `rebar_sizes`, `estimation_learnings`, `estimation_validation_rules`
- **Storage**: `estimation-files` bucket

### What's Missing (Gaps)

1. **No dedicated Estimator edge function** -- Gauge can chat about estimation but cannot run a structured, deterministic takeoff pipeline that produces a formal BOM/cost output
2. **No Detailer Agent** -- No CAD/DXF drawing generation capability
3. **No estimation projects/sessions table** -- No way to persist a takeoff as a project with revisions
4. **No cost calculation engine** -- No labor rates, material pricing, waste factor application
5. **No structured output format** -- The current extraction returns raw JSON but doesn't produce a downloadable Excel/PDF estimate
6. **No CRSI/ACI rule engine** -- `rebar_standards` has multipliers but no code to compute hook allowances, lap splices, development lengths deterministically
7. **No estimation-specific tools for the Gauge agent** -- Cannot save takeoffs, create quotes from estimates, or write results back to orders

## Implementation Plan

### Step 1: Database Schema -- Estimation Projects and Takeoff Items

Create tables to persist estimation sessions and their line items:

**`estimation_projects`** -- A takeoff session/project
- `id` UUID PK
- `name` TEXT (e.g. "20 York St - Foundation")
- `customer_id` UUID FK (nullable)
- `lead_id` UUID FK (nullable)
- `status` TEXT (draft / in_progress / completed / approved)
- `source_files` JSONB (array of uploaded file URLs + names)
- `element_summary` JSONB (counts by element type: footings, columns, beams, slabs)
- `total_weight_kg` NUMERIC
- `total_cost` NUMERIC
- `waste_factor_pct` NUMERIC DEFAULT 5
- `labor_hours` NUMERIC
- `notes` TEXT
- `created_by` UUID
- `company_id` UUID
- `created_at`, `updated_at` TIMESTAMPTZ

**`estimation_items`** -- Individual rebar lines from takeoff
- `id` UUID PK
- `project_id` UUID FK -> estimation_projects
- `element_type` TEXT (footing, column, beam, slab, wall, pier)
- `element_ref` TEXT (e.g. "C1", "F2", "B3")
- `mark` TEXT
- `bar_size` TEXT (e.g. "20M")
- `grade` TEXT (e.g. "400W")
- `shape_code` TEXT (ASA code)
- `quantity` INTEGER
- `cut_length_mm` NUMERIC (raw bar length before hooks/laps)
- `total_length_mm` NUMERIC (with hook/lap allowances applied)
- `hook_allowance_mm` NUMERIC
- `lap_allowance_mm` NUMERIC
- `weight_kg` NUMERIC (computed: total_length * mass_per_m * quantity)
- `spacing_mm` NUMERIC
- `dimensions` JSONB (A, B, C, D, E, F, G, H, J, K values)
- `unit_cost` NUMERIC
- `line_cost` NUMERIC
- `source` TEXT (ai_extracted / manual / revised)
- `warnings` TEXT[]
- `created_at` TIMESTAMPTZ

**`estimation_pricing`** -- Material and labor rates
- `id` UUID PK
- `company_id` UUID
- `bar_size` TEXT
- `material_cost_per_kg` NUMERIC
- `labor_rate_per_hour` NUMERIC
- `kg_per_labor_hour` NUMERIC (productivity factor)
- `effective_date` DATE
- `is_active` BOOLEAN DEFAULT true

RLS: All scoped to `company_id` via `auth.uid()` join to `profiles`.

### Step 2: Rebar Calculation Engine (Shared Module)

Create `supabase/functions/_shared/rebarCalcEngine.ts` -- a deterministic calculation module (no AI, pure math):

- `computeHookAllowance(barSize, hookType, standards)` -- Uses `hook_90_extension_mult` and `hook_180_extension_mult` from `rebar_standards` to compute exact mm
- `computeLapSplice(barSize, spliceType, standards)` -- Uses `lap_tension_mult` / `lap_compression_mult`
- `computeDevelopmentLength(barSize, standards)` -- Uses `development_length_mult`
- `computeBendDeduction(barSize, standards)` -- Uses `bend_radius_mult`, `hook_90_deduction`, `hook_180_deduction`
- `computeBarWeight(barSize, lengthMm, standards)` -- Uses `weight_per_meter` from `rebar_standards`
- `computeTotalLength(cutLength, hooks, laps)` -- Sums raw + allowances
- `computeLineCost(weightKg, pricing)` -- Weight * material cost
- `computeLaborHours(totalWeightKg, pricing)` -- Weight / kg_per_labor_hour
- `applyWasteFactor(items, wastePct)` -- Adds scrap percentage
- `validateItem(item, rules)` -- Checks against `estimation_validation_rules` (min/max bar sizes, lengths, spacing)

All formulas reference CSA G30.18 / RSIC 2018 standards stored in the database.

### Step 3: AI Estimation Edge Function

Create `supabase/functions/ai-estimate/index.ts` -- the main estimation pipeline:

**Input:** Uploaded structural/architectural drawings (PDF/images) + optional scope context

**Pipeline:**
1. **Preprocessing**: Convert PDFs to images via `pdf-to-images`, run OCR via `google-vision-ocr`
2. **AI Extraction (Gemini 2.5 Pro)**: Vision model identifies structural elements (columns, beams, footings, slabs) and extracts:
   - Element type, reference, dimensions
   - Bar sizes, quantities, spacing
   - Hook types, lap requirements
   - Notes, scales, general specifications
3. **Deterministic Calculation**: For each extracted item, run through `rebarCalcEngine`:
   - Look up bar properties from `rebar_standards`
   - Compute hook allowances, lap splices per RSIC rules
   - Calculate total lengths, weights, costs
   - Apply waste factors
   - Validate against `estimation_validation_rules`
4. **Persist**: Save to `estimation_projects` + `estimation_items`
5. **Output**: Return structured JSON with full BOM, summary, warnings, and cost breakdown

### Step 4: Estimation Tools for Gauge Agent

Add estimation-specific tools to `agentTools.ts` for the `estimation` agent:

- **`run_takeoff`**: Trigger the `ai-estimate` function with attached files, returns project ID and summary
- **`get_estimate_summary`**: Fetch an estimation project's summary and item breakdown
- **`update_estimate_item`**: Manually correct/override an AI-extracted item (mark, quantity, length)
- **`apply_waste_factor`**: Recalculate with a different waste percentage
- **`convert_to_quote`**: Create a quote record from the estimation project, linking to the customer/lead
- **`export_estimate`**: Generate downloadable output (structured JSON for now, Excel in future)

### Step 5: Upgrade Gauge Agent Prompt

Rewrite `specialists.ts` estimation prompt to:
- Include CRSI/ACI rule references (hook = 6d for 90 deg, 12d for 180 deg, lap = 40-60d)
- Include CSA G30.18 bar size reference table
- Include OSHA 1926.701 safety flag instructions
- Reference the new tools and explain when to use `run_takeoff` vs manual calculation
- Add structured output format expectations for takeoff results
- Include waste factor guidance (3-5% standard, higher for complex shapes)

### Step 6: Estimation UI Page

Create `src/pages/Estimation.tsx` with:
- **Upload zone**: Drag-and-drop structural drawings (PDF/images)
- **Scope confirmation**: User confirms project name, customer, element types to estimate
- **Progress indicator**: Shows pipeline stages (OCR -> Extraction -> Calculation -> Validation)
- **Results table**: Sortable/editable grid of estimation items (element, mark, bar size, qty, length, weight, cost)
- **Summary cards**: Total weight, total cost, labor hours, waste percentage
- **Warnings panel**: Validation flags (e.g., unusual bar sizes, missing data)
- **Actions**: Export, Convert to Quote, Save Draft, Revise

## Technical Details

### Calculation Example (CSA/RSIC)
For a 20M bar in a column with 90-degree hooks both ends:
- Bar diameter: 19.5mm (from `rebar_standards`)
- Hook allowance: 19.5 * 6 = 117mm per hook = 234mm total
- Hook deduction: from `hook_90_deduction` field
- Net total length = cut_length + hook_allowances - hook_deductions
- Weight = total_length_m * 2.355 kg/m (from `weight_per_meter`)
- Cost = weight * material_cost_per_kg

### AI Model Selection
- **Gemini 2.5 Pro**: For vision analysis of drawings (needs multimodal + large context)
- **Gemini 2.5 Flash**: For structured data extraction from OCR text
- Deterministic calculations use NO AI -- pure TypeScript math from database standards

### File Flow
```text
Upload (PDF/Image)
  -> pdf-to-images (if PDF)
  -> google-vision-ocr (per page)
  -> Gemini 2.5 Pro (element identification + rebar extraction)
  -> rebarCalcEngine (deterministic math)
  -> estimation_items (persist)
  -> Summary + BOM output
```

## Implementation Sequence

| Step | What | Effort |
|------|------|--------|
| 1 | Database tables (estimation_projects, items, pricing) + RLS | 1 hour |
| 2 | rebarCalcEngine.ts (deterministic calculations) | 1.5 hours |
| 3 | ai-estimate edge function (full pipeline) | 2 hours |
| 4 | Estimation tools for Gauge agent | 1 hour |
| 5 | Upgrade Gauge prompt with CRSI/ACI/OSHA rules | 30 min |
| 6 | Estimation UI page | 2 hours |
| **Total** | | **~8 hours** |

## Out of Scope (Future Phases)

- **CAD/DXF Drawing Generation (Detailer Agent)**: Requires DXF library integration; planned for Phase 2
- **Excel Export**: Requires server-side XLSX generation; can leverage existing `xlsx` dependency
- **BIM/Tekla Integration**: Enterprise feature, requires API access
- **Fine-tuned vision model for rebar drawings**: Would improve accuracy but requires training data collection first

