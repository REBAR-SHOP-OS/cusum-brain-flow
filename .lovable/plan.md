

# Make Timeline Quotation Entry Clickable to Open Editor

## Problem
The quotation entry in the sales lead timeline is not clickable. Users cannot navigate to edit the quotation from the timeline.

## Approach
Two changes needed:

### 1. Store quote ID in the activity record
Currently the "Add to Timeline" insert in `DraftQuotationEditor.tsx` does not store the quote ID. We need to embed it in the `subject` or `body` field since `sales_lead_activities` has no metadata column.

Best approach: include the quote ID in the body text in a parseable format, e.g.:
```
Draft quotation. Total: $108.92 [quote_id:UUID_HERE]
```

### 2. Make quotation activities clickable in the timeline
In `SalesLeadChatter.tsx`, detect `activity_type === "quotation"` entries and render the subject as a clickable link. Extract the quote ID from the body text and navigate to:
```
/sales/quotations?lead_id=LEAD_ID&edit=QUOTE_ID
```

### 3. Auto-open editor from URL param
In `AccountingDocuments.tsx`, read an `edit` query parameter on mount. If present, set `draftEditorId` to that value so the editor opens automatically.

## Files to change

| File | Change |
|---|---|
| `src/components/accounting/documents/DraftQuotationEditor.tsx` | Append `[quote_id:ID]` to body when inserting timeline activity |
| `src/components/sales/SalesLeadChatter.tsx` | Make quotation activities clickable, parse quote ID, navigate |
| `src/components/accounting/AccountingDocuments.tsx` | Read `edit` URL param on mount, auto-open editor |

## No database changes needed

