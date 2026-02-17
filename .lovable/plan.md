

# Fix: Priority Stars and Activity Icons to Match Odoo

## Problems Identified

### 1. Duplicate leads inflating priority
There are duplicate leads with the same `odoo_id` -- one from Odoo sync (correct: `odoo_priority: 0`, 0 stars) and one from RFQ email scan (wrong: `priority: medium`, showing 2 stars). These duplicates are cluttering the board and showing incorrect star ratings.

Example: `odoo_id 5200` exists twice:
- Odoo-synced: "FW: Bid Invite: Credit Valley Hospital..." (0 stars, correct)
- Email-sourced: "S01535, FW: Bid Invite: Credit Valley Hospital..." (2 stars, wrong)

### 2. Priority fallback shows wrong stars
When a lead has an `odoo_id` but no `odoo_priority` (email-sourced duplicates), it falls back to `lead.priority = "medium"` which shows 2 stars. Odoo shows 0 stars for these leads.

### 3. Activity icon style doesn't match Odoo
ERP uses a Clock icon for activity status. Odoo uses horizontal bar icons for activity status indicators.

## Solution

### 1. Fix priority display (`src/components/pipeline/LeadCard.tsx`)
If a lead has an `odoo_id` in metadata, only use `odoo_priority` for stars -- never fall back to `lead.priority`. This ensures Odoo-synced data is the source of truth.

### 2. Fix priority display in column header (`src/components/pipeline/PipelineColumn.tsx`)
Same logic fix for the priority distribution bar in column headers.

### 3. Fix priority sorting (`src/pages/Pipeline.tsx`)
Same logic fix in the `leadsByStage` sorting function so sort order matches Odoo.

### 4. Change activity icon to match Odoo
Replace the `Clock` icon with a horizontal bars icon (using `AlignJustify` or similar from lucide-react) to visually match Odoo's activity status indicators.

### 5. Clean up duplicate leads (data fix)
Remove the email-sourced duplicate leads that share an `odoo_id` with an Odoo-synced lead, keeping only the Odoo-synced version.

## Technical Details

### Priority logic change (all 3 files)

Current:
```typescript
function getPriorityStars(lead: Lead): number {
  const meta = lead.metadata as Record<string, unknown> | null;
  const odooPriority = meta?.odoo_priority as string | undefined;
  if (odooPriority) return Math.min(parseInt(odooPriority) || 0, 3);
  if (lead.priority === "high") return 3;
  if (lead.priority === "medium") return 2;
  return 0;
}
```

Fixed:
```typescript
function getPriorityStars(lead: Lead): number {
  const meta = lead.metadata as Record<string, unknown> | null;
  // If lead has an odoo_id, only use odoo_priority (source of truth)
  const hasOdooId = !!meta?.odoo_id;
  const odooPriority = meta?.odoo_priority as string | undefined;
  if (odooPriority !== undefined && odooPriority !== null) {
    return Math.min(parseInt(odooPriority) || 0, 3);
  }
  if (hasOdooId) return 0; // Odoo lead without priority data = 0 stars
  if (lead.priority === "high") return 3;
  if (lead.priority === "medium") return 2;
  return 0;
}
```

### Activity icon change (`src/components/pipeline/LeadCard.tsx`)
Replace `Clock` import with `AlignJustify` (horizontal bars) to match Odoo's visual style for activity indicators.

### Duplicate cleanup (SQL)
Delete email-sourced duplicate leads that share an `odoo_id` with a properly synced lead:

```sql
DELETE FROM leads
WHERE id IN (
  SELECT l1.id FROM leads l1
  JOIN leads l2 ON (l1.metadata->>'odoo_id') = (l2.metadata->>'odoo_id')
  WHERE l1.id != l2.id
  AND l1.title LIKE 'S0%,%'
  AND l2.title NOT LIKE 'S0%,%'
)
```

## Files Modified

| File | Change |
|---|---|
| `src/components/pipeline/LeadCard.tsx` | Fix priority logic; change Clock to horizontal bars icon |
| `src/components/pipeline/PipelineColumn.tsx` | Fix priority logic in header bar |
| `src/pages/Pipeline.tsx` | Fix priority logic in sort function |

