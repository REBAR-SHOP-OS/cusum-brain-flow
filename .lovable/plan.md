

## Plan: Wire Upload Zone & Enhance "Add Quotation" Button

### 1. Make "Add Quotation" button green with dropdown (Manual / AI Auto)
**File: `src/components/accounting/AccountingDocuments.tsx`** (lines 246-250)

Replace the single "Add Quotation" button with a split dropdown using `DropdownMenu`:
- **Green background** (`bg-emerald-600 hover:bg-emerald-700 text-white`)
- Two options:
  - **"Manual Upload"** — scrolls to / highlights the drag-and-drop zone (or triggers file picker)
  - **"AI Auto (from Estimation)"** — opens the existing `GenerateQuotationDialog`

Add imports for `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger` and `ChevronDown`.

### 2. Wire the drag-and-drop upload zone to quotation creation
**File: `src/components/accounting/AccountingDocuments.tsx`** (lines 283-291)

The `DocumentUploadZone` with `targetType="estimate"` already handles AI extraction from uploaded files. Update the `onImport` callback to:
- After extraction, also invalidate the `archived_quotations` query so the new quotation appears in the list immediately
- Show a richer toast with the quote number if available from the import result

### Files to modify:
- **`src/components/accounting/AccountingDocuments.tsx`** — replace button with green dropdown, wire upload zone callback

