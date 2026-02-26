

## Plan: Remove Packing Slips, Add AI Quotation Builder, Add "Convert to Quotation" in Pipeline

### 1. Remove "Packing Slips" from quick-access strip
**File: `src/pages/AccountingWorkspace.tsx`** (line 340)
- Remove the Packing Slips entry from the quick-access tabs array

### 2. Remove Packing Slips sub-tab from Documents
**File: `src/components/accounting/AccountingDocuments.tsx`** (lines 209-211)
- Remove the `packing-slip` entry from `docTabs` array
- Replace with a quotation tab or remove entirely since quotations are the main view
- Set default `activeDoc` to `"quotation"` instead of `"packing-slip"`

### 3. Add "Add Quotation" button with AI integration
**File: `src/components/accounting/AccountingDocuments.tsx`** (lines 246-258)
- Replace the "Add Packing Slip" button with an "Add Quotation" button
- The button opens a dialog/sheet that:
  - Fetches estimation projects from `estimation_projects` table
  - Lets user select an estimation project
  - Calls an edge function (`ai-generate-quotation`) that uses Gemini to build a quotation from the estimation BOM data
  - Inserts the result into the `quotes` table with `source: "ai_estimation"`

### 4. Create edge function: `ai-generate-quotation`
**File: `supabase/functions/ai-generate-quotation/index.ts`**
- Accepts `estimation_project_id` and optional `lead_id`
- Fetches BOM items from `estimation_bom_items` and project details from `estimation_projects`
- Uses Gemini 2.5 Flash via Lovable AI to format items into a professional quotation
- Inserts into `quotes` table with line items in metadata
- Returns the created quote

### 5. Create "Generate Quotation" dialog component
**File: `src/components/accounting/GenerateQuotationDialog.tsx`**
- Select estimation project dropdown (fetches from `estimation_projects`)
- Optional customer name override
- "Generate with AI" button triggers the edge function
- Shows loading state during generation
- On success, refreshes quotation list

### 6. Add "Convert to Quotation" button in Pipeline
**File: `src/components/pipeline/LeadDetailDrawer.tsx`** (around line 118, action buttons area)
- Add a `FileText` icon button labeled "→ Quotation" next to the Edit/Close buttons
- Clicking it:
  - Checks if the lead has a linked `estimation_project` (via `estimation_projects.lead_id`)
  - If yes: calls `ai-generate-quotation` with the estimation project and lead data
  - If no: calls `ai-generate-quotation` with just the lead's customer/revenue data to create a basic quotation
  - Shows toast on success with link to view in Accounting

### Files to create/modify:
- **Create** `supabase/functions/ai-generate-quotation/index.ts`
- **Create** `src/components/accounting/GenerateQuotationDialog.tsx`
- **Modify** `src/components/accounting/AccountingDocuments.tsx` — remove packing slip, add quotation button
- **Modify** `src/pages/AccountingWorkspace.tsx` — remove Packing Slips from strip
- **Modify** `src/components/pipeline/LeadDetailDrawer.tsx` — add "Convert to Quotation" action

