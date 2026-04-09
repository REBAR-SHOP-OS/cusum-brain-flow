

# Add "Back to Lead" Navigation Button

## Problem
The "Previous" button the user circled is actually a pagination control (disabled on page 1). There is no button to navigate back to the sales lead the user came from in the pipeline.

## Fix
Add a "Back to Lead" button at the top of the quotations page that appears only when `lead_id` is present in the URL. Clicking it navigates to `/sales/pipeline?lead={lead_id}` to open the lead drawer.

### File: `src/components/accounting/AccountingDocuments.tsx`

1. Import `useNavigate` from `react-router-dom` (already has `useSearchParams`)
2. Import `ArrowLeft` icon from lucide-react
3. Read `lead_id` from search params (already done: `leadIdParam`)
4. Add a "Back to Lead" button near the top of the page, visible only when `leadIdParam` exists:

```tsx
{leadIdParam && (
  <Button
    variant="ghost"
    size="sm"
    className="gap-1"
    onClick={() => navigate(`/sales/pipeline?lead=${leadIdParam}`)}
  >
    <ArrowLeft className="w-4 h-4" /> Back to Lead
  </Button>
)}
```

## Scope
- 1 file: `AccountingDocuments.tsx`
- No database changes

