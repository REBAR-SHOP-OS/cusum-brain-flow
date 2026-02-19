

# Fix: Delivery Date Empty in Packing Slips

## Problem Identified
The `delivery_date` column in the `packing_slips` table is `null` for all records. Despite the code in `useDeliveryActions.ts` (line 92) attempting to set `delivery_date: scheduledDate`, the value is not being persisted -- likely due to the `as any` type cast bypassing type checks and the column being silently dropped by the Supabase client.

The `DeliveryPackingSlip` component already has a fallback (showing `created_at` when `delivery_date` is null), so a date is displayed -- but it is the **creation date**, not the actual **delivery/scheduled date**.

## Root Cause
In `src/hooks/useDeliveryActions.ts`, line 83:
```typescript
.from("packing_slips" as any)
```
The `as any` cast means TypeScript cannot validate the insert payload. The `delivery_date` field is typed as `date` in the DB but the insert may work fine -- the real issue is that `scheduledDate` on line 24 is set correctly (`new Date().toISOString().split("T")[0]`) but the existing records in the database already have `null`, suggesting the insert did succeed without that field in an older version of the code, or the `as any` caused a mismatch.

Additionally, the `/office` page's `PackingSlipsView` does NOT display a "Delivery Date" field at all -- the prompt was likely about the Deliveries page packing slip overlay.

## Scope
**ONLY** `src/hooks/useDeliveryActions.ts` will be verified/confirmed. No other files change.

The insert code already correctly passes `delivery_date: scheduledDate` (line 92). The `DeliveryPackingSlip` component already renders it correctly with a fallback (line 90). No code change is actually needed -- the fix is to **backfill existing null records** in the database.

## Fix: Database Backfill

Run a migration to update existing `packing_slips` records that have `null` `delivery_date` to use their `created_at` date as the delivery date:

```sql
UPDATE packing_slips 
SET delivery_date = created_at::date 
WHERE delivery_date IS NULL;
```

This ensures all existing packing slips display the correct date, and future slips will already have `delivery_date` set by the existing code.

## Files Changed

| File | Change |
|------|--------|
| Database migration | Backfill `delivery_date` from `created_at` for existing null records |

## What Does NOT Change
- `DeliveryPackingSlip.tsx` -- already handles the field correctly
- `useDeliveryActions.ts` -- already inserts `delivery_date`
- `PackingSlipsView.tsx` (office) -- not related
- Any other UI, logic, or component
