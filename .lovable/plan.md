
# Fix the Learning Engine Ingestion Pipeline

## What's Wrong Right Now

The ingestion pipeline shows **0/0 job_logs** and **0/811 barlists (completed)** but **zero items were actually ingested**. Three critical bugs:

1. **Wrong storage bucket**: The edge functions look in a bucket called `odoo-archive`, but your files are in the `estimation-files` bucket under the `odoo-archive/` prefix path
2. **Too-strict file name matching**: Only files containing "bar_list" or "barlist" are picked up (9 matches), but you have **1,573 XLS files** across **344 leads** -- most are RebarCAD exports with names like "MASONRY WALL - BPF.xlsx" or "FOOTINGS AND WALLS - BPD.xlsx"
3. **No PDF shop drawing analysis**: You have **4,157 PDFs** (real structural drawings) sitting untouched -- the ingestion only looks at XLS files

## Your Actual Data Goldmine

| Asset | Count | Status |
|-------|-------|--------|
| Total files in storage | 9,629 | Untouched |
| XLS/XLSX files (RebarCAD exports) | 1,573 | 0 parsed |
| PDF files (shop drawings) | 4,157 | 0 analyzed |
| Files named "barlist" | 478 XLS | 0 ingested |
| Files named "job log" | 284 XLS | 0 ingested |
| Leads with XLS files | 344 | 0 processed |
| Total leads in storage | 1,606 | 0 processed |

## The Fix (3 Parts)

### Part 1: Fix `ingest-historical-barlists`
- Change storage bucket from `odoo-archive` to `estimation-files`
- Change file listing path from `{lead_id}/` to `odoo-archive/{lead_id}/`
- Use `lead_files` table instead of raw storage listing (it has 15,787 indexed files with proper lead_id mapping)
- Accept ALL XLS/XLSX files (not just "barlist"-named ones) -- the RebarCAD parser already validates the structure
- Process in batches of 20 leads per invocation

### Part 2: Fix `ingest-job-logs`
- Same bucket/path fix as above
- Query `lead_files` where `file_name ILIKE '%job%log%'` (284 files available)
- Parse estimation vs. detailing weights into `project_coordination_log`

### Part 3: New `ingest-shop-drawings` -- AI-Powered PDF Analysis
This is the big one. Use Gemini 2.5 Pro to analyze the 4,157 PDF shop drawings and extract rebar data directly from the structural drawings.
- New edge function that processes PDF files through Gemini vision
- For each PDF: download, convert to base64, send to Gemini 2.5 Pro with the full Canadian rebar notation prompt (already written in `ai-estimate`)
- Store extracted items as `barlist_items` with `source_type: 'ai_vision_extract'`
- This creates the ground truth that the Learning Engine compares against AI estimations
- Process 2-3 PDFs per invocation (large files + AI processing time)

### Part 4: Auto-Continue UI
- Add "Auto-Run" toggle to the dashboard that keeps calling the ingestion functions until all batches are done (currently you have to click the button repeatedly)
- Show real-time progress with file counts, not just lead counts
- Add a "Reset" button to clear completed status and re-run

### Part 5: Fix `build-learning-pairs`
- Currently finds 0 matches because no data was ingested
- After Parts 1-3 populate real data, this will work correctly
- Add cross-referencing: match XLS barlists to PDF extractions for same lead to build comparison pairs

## Technical Details

### Edge Function Changes

**`ingest-historical-barlists/index.ts`** -- Rewrite to:
- Query `lead_files` table for XLS/XLSX files (not raw storage listing)
- Download from `estimation-files` bucket using `storage_path` column
- Try RebarCAD parsing on every XLS; skip if parser returns 0 items
- Track progress by `last_processed_lead_id` correctly
- Reset `ingestion_progress` status to allow re-runs

**`ingest-job-logs/index.ts`** -- Rewrite to:
- Query `lead_files` where `file_name ILIKE '%job%log%'`
- Same bucket fix
- Count total job log files upfront for accurate progress bar

**New: `ingest-shop-drawings/index.ts`**:
- Query `lead_files` for PDF files
- Download PDF, convert to base64
- Call Gemini 2.5 Pro with the full rebar extraction prompt
- Parse JSON response into `barlist_items`
- Rate-limit: 2 PDFs per batch to stay within API limits
- Log each extraction to `project_coordination_log` with weights

### UI Changes (`CoordinationDashboard.tsx`)
- Add 4th button: "Ingest Shop Drawings (AI Vision)"
- Add auto-continue loop with a toggle switch
- Add "Reset Pipeline" button to clear completed status
- Show file-level progress (e.g., "127/478 bar list files parsed")
- Add error log viewer showing which files failed and why

### Database Migration
- Add `source_type` to `ingestion_progress` to track XLS vs PDF vs job_log separately
- Add index on `lead_files(lead_id, file_name)` for faster queries

## Processing Timeline
- **478 bar list XLS files**: ~5 minutes (pure parsing, no AI)
- **284 job log XLS files**: ~3 minutes (pure parsing, no AI)
- **1,095 other XLS files**: ~8 minutes (RebarCAD parsing attempt)
- **4,157 PDF shop drawings via Gemini Pro**: ~35 hours at 2 PDFs/minute (this is the long-running one -- the auto-continue UI handles this)

## Result
After full ingestion, you'll have:
- Thousands of real barlist items parsed from your historical RebarCAD exports
- Hundreds of coordination logs with estimation vs. actual weights from job logs
- AI-extracted rebar data from real shop drawings
- Learning pairs that teach the AI estimator your company's actual patterns
- The estimation AI will use all of this as few-shot context for future takeoffs
