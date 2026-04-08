

# Restrict Sales Pipeline Assignees to Neel & Saurabh

## Change

### `src/pages/sales/SalesPipeline.tsx` (line 98)

Replace the broad `is_active` filter with the same email-based restriction used in `LeadFormModal.tsx`:

```typescript
// Before:
const activeProfiles = (profiles ?? []).filter(p => p.is_active);

// After:
const SALES_ASSIGNEE_EMAILS = ["neel@rebar.shop", "saurabh@rebar.shop"];
const activeProfiles = (profiles ?? []).filter(
  p => p.is_active && p.email && SALES_ASSIGNEE_EMAILS.includes(p.email.toLowerCase())
);
```

This ensures the assignee dropdown, filter checkboxes, and drawer assignee manager all show only Neel and Saurabh — matching the CRM pipeline behavior exactly.

| File | Change |
|------|--------|
| `src/pages/sales/SalesPipeline.tsx` | Filter assignees to neel + saurabh only |

