

## Problem

Invoice #, Invoice Date, and Scope all show "—" on the packing slip because `useDeliveryActions.ts` never writes these three fields to the `packing_slips` table when creating the record (lines 126-136). The columns exist in the DB and the Deliveries page reads them, but they're simply never populated.

## Fix

### 1. `src/hooks/useDeliveryActions.ts` — accept and persist invoice/scope data

- Change `createDeliveryFromBundle` signature to accept `invoiceNumber` plus an optional `scope` parameter
- Before inserting the packing slip, fetch `invoice_date` from the extract session (same chain as invoice number: `cut_plans → barlists → extract_sessions`)
- Also fetch the `scope` from the extract session (or fall back to `bundle.planName`)
- Add `invoice_number`, `invoice_date`, and `scope` to the packing slip insert

### 2. `src/pages/LoadingStation.tsx` — pass scope along

- The `invoiceNumber` is already resolved and passed. No change needed there.
- Fetch `invoice_date` and `scope` from the same extract session query that already fetches invoice number, and pass them through to `createDeliveryFromBundle`.

### 3. `src/hooks/useCompletedBundles.ts` — add scope to bundle

- Fetch `extract_sessions.scope` and `extract_sessions.invoice_date` alongside invoice_number so they're available on the bundle object (or fetch them in the delivery action).

**Simpler approach**: Since `useDeliveryActions` already receives the `invoiceNumber` string, just also pass `scope` (from `bundle.planName` or extract session) and fetch `invoice_date` inside `useDeliveryActions` from the extract session before inserting.

### Changes summary

**`src/hooks/useDeliveryActions.ts`**:
- Fetch `invoice_date` from extract session via the same `cut_plans → barlists → extract_sessions` chain
- Fetch `scope` from extract session (field name to confirm, likely `scope` or from `cut_plans.project_name`)
- Add `invoice_number: invoiceNumber`, `invoice_date`, and `scope` to the packing slip insert object

**`src/pages/LoadingStation.tsx`**:
- No structural change needed — `invoiceNumber` is already passed. The delivery action will self-resolve the other fields.

