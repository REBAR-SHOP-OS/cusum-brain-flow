

## Problem

The Loading Station requires manual entry of an invoice number, but this data already exists in the extract session (set during the "Initialize Scope" step). The operator has to re-type it.

## Data Chain

```text
cut_plans.project_id → barlists.project_id + barlists.extract_session_id → extract_sessions.invoice_number
```

## Fix

### `src/pages/LoadingStation.tsx`

1. **Auto-fetch invoice number on bundle selection**: When `selectedBundle` changes, query the DB to find the invoice number:
   - Join from `barlists` where `project_id = cut_plans.project_id` (using the bundle's `cutPlanId` to get the project)
   - Follow `extract_session_id` → `extract_sessions.invoice_number`
   - Pick the most recent non-null invoice number

2. **Pre-fill `invoiceNumber` state**: If a match is found, call `setInvoiceNumber(result)` so the field is pre-populated. The operator can still edit it if needed.

3. **Implementation**: Add a `useEffect` or inline query that runs when `selectedBundle` changes:
   ```text
   SELECT es.invoice_number
   FROM cut_plans cp
   JOIN barlists b ON b.project_id = cp.project_id
   JOIN extract_sessions es ON es.id = b.extract_session_id
   WHERE cp.id = <cutPlanId>
     AND es.invoice_number IS NOT NULL
   ORDER BY es.created_at DESC
   LIMIT 1
   ```
   If found, set `invoiceNumber` to that value.

4. The invoice number input remains editable — this is a convenience pre-fill, not a lock.

