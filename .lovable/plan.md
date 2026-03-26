

# Audit & Fix: Manual + AI Auto Quotation Flows

## Issues Found

### Bug 1: Query key mismatch in GenerateQuotationDialog
`GenerateQuotationDialog.tsx` line 59 invalidates `["archived_quotations"]` (underscore) but the hook `useArchivedQuotations` uses `["archived-quotations"]` (hyphen). Result: after AI generation, the quotation list does not refresh.

### Bug 2: AI Auto dialog is project-picker only — no file upload
The current "AI Auto" flow only lets users select an existing estimation project from a dropdown. There is no way to drag-and-drop or paste files directly. Users must first go to the Estimation page, create a project, then come back. This is the main gap.

### Bug 3: No pipeline task linking from AI Auto
After generating a quotation via AI Auto, there is no option to link it to a sales lead or add it to the pipeline.

---

## Plan

### 1. Fix query key mismatch
**File: `src/components/accounting/GenerateQuotationDialog.tsx`**
- Line 59: Change `["archived_quotations"]` to `["archived-quotations"]`

### 2. Expand AI Auto dialog with drag-and-drop file upload
**File: `src/components/accounting/GenerateQuotationDialog.tsx`** — major enhancement

Add two modes inside the dialog:
- **Mode A (existing)**: Select from existing estimation projects (current dropdown)
- **Mode B (new)**: Upload files directly (drag-and-drop zone + paste support) to run a new takeoff inline

The dialog becomes a tabbed interface:
```text
┌──────────────────────────────────────────┐
│ ✨ Generate AI Quotation                 │
│                                          │
│  [From Project]  [Upload New Files]      │
│                                          │
│  Tab 1: existing project dropdown        │
│  Tab 2: drag/drop zone + project name    │
│         + customer select + lead select  │
│         → runs ai-estimate → then        │
│           ai-generate-quotation          │
│                                          │
│  ☐ Add to Sales Pipeline                 │
│                                          │
│  [Cancel]  [Generate with AI]            │
└──────────────────────────────────────────┘
```

**Upload tab features:**
- Drag-and-drop zone (accepts PDF, images, XLSX, CSV)
- Paste support via `onPaste` event (for pasted images/files)
- File preview badges
- Project name input (auto-generated from filename if empty)
- Customer dropdown (from `v_customers_clean`)
- Lead dropdown (filtered by customer)
- On generate: calls `ai-estimate` first to create estimation project, then calls `ai-generate-quotation` with the new project ID

### 3. Add "Link to Pipeline" option
In both modes, add a checkbox: "Add to Sales Pipeline". When checked, after quotation is created:
- If a lead is selected, create a `sales_lead_activities` entry linking the quote
- If no lead exists, create a new lead with the quotation amount and customer

### Technical details

**Files changed:**
- `src/components/accounting/GenerateQuotationDialog.tsx` — expand with upload mode, paste/drop, customer/lead selectors, pipeline toggle, fix query key
- No backend changes needed — uses existing `ai-estimate` and `ai-generate-quotation` edge functions

**Dependencies used:**
- Existing `uploadToStorage` from `@/lib/storageUpload`
- Existing `supabase.functions.invoke("ai-estimate")` 
- Existing `supabase.functions.invoke("ai-generate-quotation")`
- Existing `v_customers_clean` view for customer list

