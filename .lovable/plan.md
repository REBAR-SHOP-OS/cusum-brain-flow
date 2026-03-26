

# Fix: View Record Link + Email Delivery Investigation

## Issue 1: View Record Link Goes to Pipeline Instead of Lead Drawer

**Current**: `recordLink` in `notify-lead-assignees/index.ts` (line 80) is:
```
https://cusum-brain-flow.lovable.app/sales/pipeline?lead={sales_lead_id}
```

**Problem**: This loads the pipeline page but doesn't automatically open the lead drawer. The `?lead=` param needs to be handled by the SalesPipeline page to auto-open the drawer.

**Fix**: Check if SalesPipeline.tsx already reads the `lead` query param to open a drawer. If not, add that logic.

## Issue 2: neel@rebar.shop Not Receiving Email

The function only sends to **assignees** of the lead. If neel is not assigned to the specific lead, they won't get a notification. Need to verify the recipient logic filters correctly.

Also: the actor (person who logged the note) is NOT excluded from recipients — so if neel is both the actor AND an assignee, they'd get an email about their own action. That's likely undesirable.

## Changes

### 1. `src/pages/sales/SalesPipeline.tsx`
- On mount / URL change, read `?lead=` query param
- If present, auto-open the SalesLeadDrawer for that lead ID

### 2. `supabase/functions/notify-lead-assignees/index.ts`
- **Exclude the actor** from recipients (don't email yourself about your own action)
- Keep all other assignees as recipients

## Files Changed

| File | Change |
|---|---|
| `src/pages/sales/SalesPipeline.tsx` | Auto-open drawer when `?lead=` query param present |
| `supabase/functions/notify-lead-assignees/index.ts` | Exclude actor from recipient list |

