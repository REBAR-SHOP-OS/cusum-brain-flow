

## Plan: Change "Manual Upload" to "Manual" (Create Draft Quotation)

### What changes
Replace the "Manual Upload" dropdown option (which opens file picker) with a **"Manual"** option that creates a real draft quotation directly in the database and opens it for editing.

### File: `src/components/accounting/AccountingDocuments.tsx`

**1. Add state for draft creation** (around line 60)
- Add `const [creatingDraft, setCreatingDraft] = useState(false);`

**2. Add draft creation function**
- Generate quote number like `QE-DRAFT-XXXXX` (random suffix)
- Insert into `quotes` table with `status: 'draft'`, `source: 'manual'`, `total_amount: 0`
- After insert, invalidate `archived-quotations` query to refresh list
- Open the preview/edit view for the newly created quote
- Show success toast

**3. Update dropdown item** (lines 257-264)
- Change from file-picker trigger to calling the draft creation function
- Label: **"Manual"** with `PenTool` icon instead of `Upload`
- Show loading spinner while creating

