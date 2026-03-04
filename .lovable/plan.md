

# Click Lead → Open in Pipeline

## What Changes

The user wants to click on a lead/opportunity card in the Customer Detail "Projects" tab and have it navigate to the Pipeline page with that lead's detail drawer open.

## Approach

**Pipeline page currently has no deep-link support.** We need to:

1. **Add URL query param support to `src/pages/Pipeline.tsx`**:
   - Read `?lead=<id>` from URL on mount using `useSearchParams`
   - If present, fetch that lead and auto-open the detail drawer (`setSelectedLead` + `setIsDetailOpen(true)`)

2. **Make lead cards clickable in `src/components/customers/CustomerDetail.tsx`**:
   - Add `useNavigate` import
   - Wrap each lead `<Card>` with `onClick={() => navigate(`/pipeline?lead=${lead.id}`)}`
   - Add `cursor-pointer hover:border-primary/50 transition-colors` styling

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Pipeline.tsx` | Add `useSearchParams`, on mount check for `?lead=` param, auto-fetch and open that lead in the detail drawer |
| `src/components/customers/CustomerDetail.tsx` | Add `useNavigate`, make lead cards clickable to navigate to `/pipeline?lead={id}` |

