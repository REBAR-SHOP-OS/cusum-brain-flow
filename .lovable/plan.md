

# Combined Plan: Wire Up Agent Tools + iBeam-Style Estimation Platform

This plan covers two parallel tracks:
1. **Fix the broken agent tool handlers** (estimation tools returning simulated responses)
2. **Rebuild the Estimation page as an iBeam.ai-style platform** (modified for rebar)

---

## Part A: Wire Up 8 Agent Tool Handlers

### Problem
In `agentToolExecutor.ts`, tools like `run_takeoff`, `get_estimate_summary`, `generate_sales_quote` all fall through to the default case returning `"Tool executed (simulated)"`. The Gauge agent cannot actually do anything.

### Changes: `supabase/functions/_shared/agentToolExecutor.ts`

Add real handler blocks for each tool:

| Tool | Logic |
|------|-------|
| `run_takeoff` | POST to `ai-estimate` edge function with name, file_urls, waste_factor_pct, scope_context |
| `get_estimate_summary` | Query `estimation_projects` + `estimation_items` by project_id |
| `update_estimate_item` | Update single `estimation_items` row by item_id |
| `apply_waste_factor` | Fetch items, recalculate via rebarCalcEngine, bulk update |
| `convert_to_quote` | POST to `convert-quote-to-order` edge function |
| `generate_sales_quote` | POST to `quote-engine` edge function |
| `export_estimate` | Query project + items, return structured JSON |
| `update_delivery_status` | Update `deliveries` table status |

All follow the existing pattern: use `svcClient` for DB, internal `fetch()` for edge functions.

### Deployment
Re-deploy `ai-agent` edge function (it imports the shared module).

---

## Part B: iBeam-Style Estimation Platform UI

### What iBeam.ai Has (that we're adapting)

iBeam's core product model:
1. **Project-based workflow**: Upload drawings -> Confirm scope -> AI takeoff -> QA review -> Export
2. **Bid Dashboard**: Track all bids by status, priority, due date, estimator, location
3. **BeamGPT**: AI assistant that reads plans and answers questions about specs
4. **Takeoff Editing Toolbar**: Edit AI results inline (adjust quantities, measurements)
5. **Addenda/Resubmit**: Upload revised plans, auto-detect changes, variance report
6. **Export**: Excel, PDF, shareable links
7. **Detailed Report View**: Spreadsheet-style with inline editing
8. **Cloud Collaboration**: Team access, shared takeoffs

### Our Modified Version (Rebar.Shop specific)

Replace the current basic `Estimation.tsx` with a full multi-section platform:

### Page Structure: `/estimation` (completely rebuilt)

**Top Navigation Bar (within the page)**
- Takeoffs | Bid Board | Quote Engine | Gauge AI

**Tab 1: Takeoffs (Project List + New Takeoff)**

A table/grid view of all estimation projects, iBeam-style:
- Columns: Project Name, Customer, Status (badge), Items Count, Total Weight (tons), Total Cost, Created Date, Estimator
- Row click opens the project detail view
- Status pills: Draft, Processing, QA Review, Completed, Quoted
- Filters: status, date range, search
- "New Takeoff" button opens a multi-step wizard

**New Takeoff Wizard (modal or inline, 4 steps like iBeam)**
- Step 1: Upload Plans (drag-drop zone for PDFs/images, show uploaded file list)
- Step 2: Confirm Scope (project name, customer, scope context, trade = "Rebar", coating type, waste factor)
- Step 3: AI Processing (animated pipeline: Uploading -> OCR -> AI Extraction -> Calculation -> Complete, with progress bar)
- Step 4: Review Results (summary cards + item table, edit inline, then "Save & Complete")

**Tab 2: Bid Board (iBeam's Bid Dashboard, adapted)**

A Kanban-style or table view pulling from `leads` where stage is estimation-related:
- Columns: Priority, Project Name, Customer, Location, Bid Due Date, Status, Estimator, Value
- Statuses: New, Scope Confirmed, Takeoff In Progress, Takeoff Complete, Quoted, Won, Lost
- Click opens lead detail with linked estimation project
- "Add Bid" button creates a new lead + estimation project together
- Filter by status, estimator, date range

**Tab 3: Quote Engine**
- Already built at `/quote-engine` -- embed or link to it
- Or integrate the new quote form directly into this tab

**Tab 4: Gauge AI (BeamGPT equivalent)**
- Split-view: chat on the left, context on the right
- Uses the existing agent system with agent="estimation"
- Can ask questions about projects, run takeoffs via chat, get summaries
- Shows linked estimation project data in the right panel

### Project Detail View (when clicking a project)

Full-page view with sub-tabs:
- **Summary**: KPI cards (total weight, cost, labor hours, waste %, item count, warnings count)
- **BOM Table**: Full editable spreadsheet-style table matching iBeam's "Detailed Report"
  - Columns: Element, Ref, Mark, Bar Size, Qty, Cut Length, Total Length, Hook, Lap, Weight, Unit Cost, Line Cost, Warnings
  - Inline editing (click cell to edit quantity, bar size, etc.)
  - Row selection for bulk operations
  - Sort/filter by element type, bar size
- **Drawings**: View uploaded source files (image preview, PDF viewer)
- **Variance/Addenda**: Upload revised drawings, run comparison takeoff, show added/removed items
- **Export**: Download as Excel (XLSX using existing xlsx library), PDF summary, JSON

### Visual Design (adapted from iBeam)
- Clean white background with subtle blue accents (matching existing app theme)
- Status badges with color coding (green=complete, blue=in progress, yellow=QA, gray=draft)
- Card-based summary sections
- Data-dense table views with hover highlights
- Animated progress pipeline during takeoff processing

---

## Database Changes

### New table: `bid_board` (for the Bid Board tab)
- `id` UUID PK
- `company_id` UUID FK
- `project_name` TEXT
- `customer_name` TEXT
- `location` TEXT
- `bid_due_date` TIMESTAMPTZ
- `priority` TEXT (low, medium, high, urgent)
- `status` TEXT (new, scope_confirmed, takeoff_in_progress, takeoff_complete, quoted, won, lost)
- `estimator_id` UUID (FK to profiles)
- `estimated_value` NUMERIC
- `estimation_project_id` UUID (FK to estimation_projects, nullable)
- `lead_id` UUID (FK to leads, nullable)
- `notes` TEXT
- `created_at`, `updated_at` TIMESTAMPTZ
- RLS: company-scoped

### Alter `estimation_projects`
- Add `status` values: 'processing', 'qa_review' (currently only 'draft', 'completed')
- Add `estimator_id` UUID (who ran the takeoff)
- Add `revision_number` INTEGER DEFAULT 1
- Add `parent_project_id` UUID (for addenda/resubmissions, nullable FK to self)

---

## New Components

| File | Purpose |
|------|---------|
| `src/pages/Estimation.tsx` | Complete rewrite with 4-tab structure |
| `src/components/estimation/TakeoffWizard.tsx` | 4-step new takeoff wizard |
| `src/components/estimation/ProjectList.tsx` | Table/grid of all projects |
| `src/components/estimation/ProjectDetail.tsx` | Full detail view with sub-tabs |
| `src/components/estimation/BOMTable.tsx` | Editable spreadsheet-style BOM |
| `src/components/estimation/BidBoard.tsx` | Bid tracking dashboard |
| `src/components/estimation/GaugeChat.tsx` | AI chat panel for estimation |
| `src/components/estimation/TakeoffPipeline.tsx` | Animated processing pipeline |
| `src/components/estimation/VarianceReport.tsx` | Addenda comparison view |
| `src/components/estimation/ExportPanel.tsx` | Export options (Excel, PDF, JSON) |

---

## Implementation Sequence

| Step | What | Effort |
|------|------|--------|
| 1 | Wire up 8 tool handlers in agentToolExecutor.ts + redeploy | 45 min |
| 2 | Database migration (bid_board table + estimation_projects alterations) | 20 min |
| 3 | ProjectList + TakeoffWizard components | 1.5 hours |
| 4 | ProjectDetail + BOMTable (editable) | 2 hours |
| 5 | BidBoard tab | 1 hour |
| 6 | GaugeChat tab (reuse agent system) | 45 min |
| 7 | VarianceReport + ExportPanel | 1 hour |
| 8 | Rebuild Estimation.tsx with 4-tab layout | 30 min |
| **Total** | | **~7.5 hours** |

---

## Technical Notes

- The Excel export uses the already-installed `xlsx` package
- The agent chat reuses the existing `sendAgentMessage()` from `src/lib/agent.ts` with `agent="estimation"`
- Inline BOM editing calls `update_estimate_item` via direct Supabase client (not through agent)
- The takeoff wizard calls `ai-estimate` edge function directly (same as current implementation)
- Variance/addenda creates a new estimation_project with `parent_project_id` pointing to the original, then diffs items
- Bid Board can optionally sync with Odoo leads via the existing `lead_id` FK

