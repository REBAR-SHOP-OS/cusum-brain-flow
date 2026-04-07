

# Move Staged Delivery Items Back to Clearance

## Root Cause
Items with `phase = 'complete'` had deliveries created (status `staged`) before going through QC clearance. There are **62 items** in `complete` phase and **14 already in `clearance`** linked to 7 staged deliveries.

## Data State
| Delivery | Project | Items |
|----------|---------|-------|
| DEL-1774367066351 | Type 6 Chamber (Small) | 12 |
| DEL-1774366970015 | PENTHOUSE FLOOR SLAB ON DECK - DMG | 22 |
| DEL-1774366966074 | 19 HALFORD AVE_STAIRCASE ADD'L | 9 |
| DEL-1774366608661 | RETAINING WALL | 11 |
| DEL-1774366011920 | RETAINING WALL | 4 |
| DEL-1773418524203 | Tower foundation | 1 |
| DEL-1773418289785 | jai shree ram | 17 |

## Plan

### 1. Database Migration
Run a single migration that:

**a)** Moves all `cut_plan_items` back to `clearance` phase where they belong to a cut plan that has a staged delivery and are currently in `complete`:
```sql
UPDATE cut_plan_items
SET phase = 'clearance'
WHERE phase = 'complete'
  AND cut_plan_id IN (
    SELECT cut_plan_id FROM deliveries WHERE status = 'staged'
  );
```

**b)** Delete the premature staged deliveries and their related records (delivery_stops, packing_slips):
```sql
-- Cascade will handle delivery_stops and packing_slips via FK
DELETE FROM deliveries WHERE status = 'staged';
```

### 2. No Code Changes
The clearance UI already picks up items with `phase = 'clearance'`. Once the data is corrected, items will appear in the Clearance screen for QC before they can proceed to Loading → Delivery again.

## Impact
- 7 staged deliveries removed
- ~62 items moved back to clearance for QC
- Items already in clearance (14) remain unaffected
- No code changes needed — data-only fix

