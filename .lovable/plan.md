

## Plan: Add PDF Export Button to Purchasing Confirmed List

### What
Add a download/PDF icon button in the Confirmed List header. When clicked, it generates a PDF of the purchasing list with item statuses, categories, and summary stats.

### Changes

**`src/components/purchasing/PurchasingConfirmedView.tsx`**
- Import `Download` icon from lucide-react and `jsPDF` (already used elsewhere in project)
- Add a PDF export button next to the "Confirmed List" heading
- On click, generate a PDF containing:
  - Header: "Confirmed List" + date + confirmed timestamp
  - Summary: purchased/rejected/pending counts
  - Items grouped by category, each showing status icon (✓/✗/○), title, and quantity
  - Footer with company branding (Rebar.Shop Inc)
- Use `jsPDF` directly (consistent with existing PDF generation patterns in the project like `pdfMarkdownRenderer.ts`)

### Technical Details
- Use `jsPDF` for PDF generation (already a project dependency)
- Color-code items: green for purchased, red for rejected, gray for pending
- Table-style layout with category headers
- Auto-download as `purchasing-list-{due_date}.pdf`

### Files to modify
- `src/components/purchasing/PurchasingConfirmedView.tsx`

