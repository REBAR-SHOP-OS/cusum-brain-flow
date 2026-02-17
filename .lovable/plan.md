

# Fix: Sync Odoo Activity Deadline to Power the Color Bar

## Problem
The colored activity bar in pipeline column headers shows only grey because 1,883 out of 2,813 leads have no `expected_close_date`. The Odoo sync function never fetches the `date_deadline` field from Odoo, so the data that drives the green/yellow/red colors simply doesn't exist in the database.

## Solution
Update the Odoo sync function to fetch and map `date_deadline` from Odoo into the `expected_close_date` field on each lead. This single change will immediately populate the activity bar with correct Odoo color semantics.

## What Changes

### 1. Odoo Sync Function (`supabase/functions/odoo-crm-sync/index.ts`)
- Add `"date_deadline"` to the `FIELDS` array so it's fetched from Odoo
- Map `date_deadline` to `expected_close_date` on both insert and update operations
- Store `date_deadline` in metadata for audit trail

### 2. No Frontend Changes Needed
The `PipelineColumn.tsx` already has the correct color logic:
- Green = planned (date in the future)
- Yellow/Orange = due today
- Red = overdue (date in the past)
- Grey = no activity date

Once the data flows from Odoo, the colors will appear automatically.

## Technical Details

### Sync function field addition
```typescript
const FIELDS = [
  "id", "name", "stage_id", "email_from", "phone", "contact_name",
  "user_id", "probability", "expected_revenue", "type", "partner_name",
  "city", "create_date", "write_date", "priority",
  "date_deadline",  // NEW: drives activity status bar colors
];
```

### Mapping in lead processing
For both insert and update:
```typescript
// Map Odoo date_deadline to expected_close_date
const dateDeadline = ol.date_deadline || null;

// In update payload:
updatePayload.expected_close_date = dateDeadline;

// In insert payload:
expected_close_date: dateDeadline,
```

### Metadata enrichment
```typescript
metadata.odoo_date_deadline = ol.date_deadline || null;
```

## After Deployment
- Run a **Full Sync** to backfill all existing leads with their `date_deadline` from Odoo
- The pipeline column headers will immediately show green/yellow/red/grey distribution bars
- Clicking bar segments will filter leads by activity status as before

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/odoo-crm-sync/index.ts` | Add `date_deadline` to FIELDS, map to `expected_close_date` on insert and update |

