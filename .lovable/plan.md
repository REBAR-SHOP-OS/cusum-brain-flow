

## Add Search + Upload Zone to Quotations Tab

### Problem
The Quotations tab in `AccountingDocuments.tsx` has a search bar and status filter, but is missing the drag-and-drop `DocumentUploadZone` that other sections (Bills, Payments, Expenses, etc.) already have. The user wants feature parity with the Bills section (as shown in the screenshot).

### Changes

**`src/components/accounting/AccountingDocuments.tsx`**:
1. Import `DocumentUploadZone` (already imported but unused in this component).
2. Add a `DocumentUploadZone` with `targetType="estimate"` (quotations map to estimates) below the search/filter bar in the quotation tab, matching the pattern used in `AccountingBills.tsx`.
3. Wire the `onImport` callback to handle the AI-extracted data (e.g., toast notification, refresh query).

The implementation follows the exact same pattern as every other accounting section — a `<DocumentUploadZone targetType="estimate" onImport={...} />` placed between the search bar and the document list.

### Technical Detail

```tsx
// Inside the {activeDoc === "quotation" && ...} block, after the search/filter div:
<DocumentUploadZone
  targetType="estimate"
  onImport={(result) => {
    console.log("Quotation import result:", result);
    // toast or refresh as needed
  }}
/>
```

No new files, no edge function changes, no DB changes — just wiring an existing component into the quotation view.

