
# Learning Engine: Train AI from 1,600+ Historical Projects for 100% Accuracy

## The Data Goldmine Already in Your ERP

| Data Source | Count | What It Contains |
|-------------|-------|-----------------|
| Leads (total) | 2,956 | Full pipeline from inquiry to delivery |
| Leads with files (odoo-archive) | 1,606 | Shop drawings, bar lists, job logs, estimation reports |
| Total files in storage | 9,629 | PDFs, XLS, DWG, images across all projects |
| Bar list files (named) | 762 | RebarCAD-exported bar lists (ground truth) |
| Shop drawing files (named) | 966 | SD-series structural drawings |
| Job log files | 358 | Coordination logs with revision tracking, weights |
| Estimation/weight summaries | 690 | Estimation reports with known totals |
| Spreadsheets (XLS/XLSX) | 1,838 | Parseable structured data (bar lists, job logs) |
| Won leads | 801 | Completed projects with known final weights |
| Delivered leads | 130 | Fully closed-loop projects |
| Existing barlists (manual) | 15 with 242 items | Already parsed production data |
| Quotes | 2,588 | Pricing history for margin learning |
| Rebar standards | 6 sizes (10M-35M) | CSA/RSIC calculation constants |

## What the Uploaded 20 York Files Teach Us

The Job Log (XLS) is the **Rosetta Stone** -- it contains:
- **Estimation Weight**: 20,812.96 kg (what the estimator predicted)
- **Detailing Weight**: 17,873.17 kg (what was actually detailed)
- **Remaining Difference**: 2,939.79 kg (the gap to learn from)
- **15 release codes** (CBA through CBQ) tracking every element from submission through fabrication
- **4 revisions** with weight deltas and reasons (A/E comments, new drawings, patches)
- **Element breakdown**: Cabana Foundation (SD01-SD03) = 4,350.91 kg, Pool Area (SD24-SD31) = 13,522.26 kg

The bar lists (CBH, CBJ, CBQ) are **RebarCAD exports** with exact mark, quantity, size, length, bend type, and dimensions -- this IS the ground truth the AI needs to match.

## The Plan: Build a Self-Learning Estimation Brain

### Phase 1: Bulk Barlist Ingestion Pipeline (New Edge Function)

**New file: `supabase/functions/ingest-historical-barlists/index.ts`**

A batch processing function that:
1. Scans `odoo-archive/{lead_id}/` folders for bar list files (XLS/XLSX/PDF with "bar_list" or "BAR_LIST" in name)
2. Parses XLS files directly using structured column mapping (the RebarCAD export format is consistent: Item, No. Pcs, Dwg.No, Size, Length, Mark, Type, A-R dimensions)
3. Parses PDF bar lists using Gemini vision (for scanned/image PDFs)
4. Stores parsed items in `barlist_items` linked to `barlists` records
5. Links each barlist to its lead via a new `lead_id` column on `barlists`
6. Processes in batches of 10 leads at a time to avoid timeouts

### Phase 2: Job Log Ingestion (Coordination Data)

**New file: `supabase/functions/ingest-job-logs/index.ts`**

Parse Job Log XLS files to extract:
- Element-level weight tracking across revisions
- Estimation vs. detailing weight deltas
- Release codes and submission dates
- Revision comments (A/E comments, patches, addendums)

**New table: `project_coordination_log`**

```
id, lead_id, company_id, project_name, customer_name,
estimation_weight_kg, detailing_weight_kg, weight_difference_kg,
elements (JSONB array of element breakdowns),
releases (JSONB array of release codes with weights/dates),
revisions (JSONB array of revision history with deltas),
source_file_url, created_at
```

This gives the AI the full coordination lifecycle for every project.

### Phase 3: Estimation vs. Actual Comparison Engine

**New file: `supabase/functions/build-learning-pairs/index.ts`**

For each project that has BOTH:
- An AI estimation (from `estimation_items`) or historical estimation weight
- A detailed bar list (from `barlist_items`) as ground truth

Generate learning pairs stored in `estimation_learnings`:
- `original_value`: what the AI/estimator predicted (bar size, quantity, cut length, weight)
- `corrected_value`: what the detailer actually produced
- `context`: element type, project type, drawing notation style
- `confidence_score`: calculated from how close the prediction was

This creates a feedback loop: every completed project teaches the AI what it got right and wrong.

### Phase 4: Enhanced AI Prompt with Historical Context

**Modify: `supabase/functions/ai-estimate/index.ts`**

Before sending drawings to Gemini, inject historical learning context:
1. Query `estimation_learnings` for relevant patterns (same element type, similar project)
2. Query `project_coordination_log` for weight benchmarks (e.g., "typical retaining wall projects in this size range weigh 8,000-15,000 kg")
3. Include top-5 most relevant bar list examples from `barlist_items` as few-shot examples
4. Add a validation step: compare AI output weights against historical benchmarks and flag anomalies

### Phase 5: Coordination Dashboard

**New file: `src/components/estimation/CoordinationDashboard.tsx`**

A view showing:
- Estimation vs. Actual weight comparison chart across all projects
- Accuracy trend over time (as more projects are ingested)
- Element-type accuracy breakdown (footings vs. walls vs. slabs)
- Revision impact analysis (how much do A/E comments typically change weights)
- Per-customer patterns (e.g., "Walden projects typically have 15% waste")

### Phase 6: Auto-Validation Against RebarCAD Bar Lists

**Modify: `src/components/estimation/ProjectDetail.tsx`**

Add a "Validate Against Bar List" button that:
1. Accepts a RebarCAD bar list upload (XLS or PDF)
2. Parses it into structured items
3. Compares mark-by-mark against AI-extracted items
4. Shows a diff view: matched items (green), missing items (red), extra items (yellow), weight discrepancies (orange)
5. Auto-records mismatches as `estimation_learnings` entries

## Database Changes

### New table: `project_coordination_log`
Stores parsed Job Log data linking estimation weights to detailing weights per element per revision.

### Modify table: `barlists`
Add `lead_id` UUID column (nullable FK to leads) to link historical bar lists back to pipeline leads.

### Modify table: `estimation_learnings`
Add columns:
- `lead_id` UUID -- link learning to specific lead
- `bar_size` text -- for bar-size-specific patterns
- `mark` text -- for mark-level matching
- `weight_delta_pct` numeric -- percentage difference for quick queries

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/ingest-historical-barlists/index.ts` | New -- batch parse 762+ bar list files from odoo-archive |
| `supabase/functions/ingest-job-logs/index.ts` | New -- parse 358 Job Log XLS files for coordination data |
| `supabase/functions/build-learning-pairs/index.ts` | New -- generate estimation vs. actual comparison pairs |
| `supabase/functions/ai-estimate/index.ts` | Modify -- inject historical context and few-shot examples into Gemini prompt |
| `src/components/estimation/CoordinationDashboard.tsx` | New -- accuracy tracking and coordination analytics |
| `src/components/estimation/ProjectDetail.tsx` | Modify -- add "Validate Against Bar List" with diff view |
| `supabase/functions/_shared/rebarCADParser.ts` | New -- shared RebarCAD XLS/PDF parsing logic |
| Database migration | New table + column additions |

## Processing Strategy

The 1,606 lead folders with 9,629 files cannot be processed in one shot. The ingestion functions will:
1. Process 10 leads per invocation (to stay within edge function timeouts)
2. Track progress in a `ingestion_progress` table
3. Be triggered via a cron job that runs every 5 minutes until complete
4. Estimated total processing time: ~13 hours for all 1,606 leads
5. Priority order: Won leads first (801), then delivered (130), then shop_drawing stage (18)

## Expected Outcome

After ingestion completes:
- ~762 bar lists parsed into structured items (tens of thousands of individual rebar items)
- ~358 coordination logs with estimation-to-actual weight tracking
- Thousands of learning pairs for the AI to reference
- The Gemini prompt will include real examples from YOUR past projects
- Accuracy validation against RebarCAD ground truth on every new takeoff
- The system learns from every correction, getting closer to 100% with each project
