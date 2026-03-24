

## Rebuild Sales Pipeline to Match Main Pipeline Template

### What
Replace the current simple Sales Pipeline board with the exact same architecture and visual design as the main Pipeline page (`/pipeline`). This means reusing `PipelineBoard`, `PipelineColumn`, and `LeadCard`-style components, plus the full header with search, stage group filters, analytics bar, and overflow menu.

### Key Differences to Bridge
The main Pipeline uses `leads` table (with `customers` join) while Sales Pipeline uses `sales_leads` table (with inline contact fields). We need an adapter layer to map `SalesLead` to the shape `PipelineColumn`/`LeadCard` expects (`LeadWithCustomer`).

### Changes

**File**: `src/pages/sales/SalesPipeline.tsx` — Major rewrite

1. **Adapter function**: Map `SalesLead` → `LeadWithCustomer` shape so we can reuse `PipelineBoard` directly:
   - `customers.name` ← `contact_name`
   - `customers.company_name` ← `contact_company`
   - Pass through all other fields with defaults for missing ones (`source`, `expected_close_date`, etc.)

2. **Header (Row 1)**: Match Pipeline exactly:
   - Title with count: `Sales Pipeline (N)`
   - `+ New` button (right side)

3. **Header (Row 2)**: Add `SalesSearchBar` (already exists) styled like `PipelineFilters`

4. **Header (Row 3)**: Add stage group filter chips (VIEW row):
   - Define `SALES_STAGE_GROUPS`: e.g. `Active` (new, contacted, qualified, estimating), `Quotes` (quote_sent, follow_up), `Closed` (won, lost)
   - Colored pills with counts, togglable, "Show all" link

5. **Board**: Replace inline column rendering with `PipelineBoard` component:
   - Pass adapted leads grouped by stage
   - Enable drag-and-drop stage changes (already works)
   - Activity status bars in column headers (uses `expected_close_date` from sales leads)

6. **Analytics**: Replace `SalesSummaryCards` with `PipelineAnalytics`-style inline badges (compact, in header)

7. **Lead cards**: Use `LeadCard` (or a thin wrapper) showing:
   - Title, company, contact name
   - Priority stars, staleness indicator
   - Expected value
   - Activity status icon (from `sales_lead_activities`)

8. **Detail drawer**: Keep existing `SalesLeadDrawer` (already upgraded to Odoo-style)

9. **Create dialog**: Keep existing dialog with contact autocomplete

**File**: `src/components/sales/SalesLeadCard.tsx` — Delete or keep as fallback (replaced by `LeadCard` via adapter)

### Technical Approach

Rather than duplicating 1000 lines, we adapt data shapes:

```typescript
function adaptSalesLead(sl: SalesLead): LeadWithCustomer {
  return {
    ...sl,
    customer_id: null,
    description: sl.description,
    win_prob_score: null,
    metadata: sl.metadata,
    customers: {
      name: sl.contact_name || sl.title,
      company_name: sl.contact_company,
    },
  } as unknown as LeadWithCustomer;
}
```

Then pass to `PipelineBoard` with `SALES_STAGES` (reformatted to match `{ id, label, color: "bg-..." }` format).

### Files Changed

| File | Change |
|---|---|
| `src/pages/sales/SalesPipeline.tsx` | Major rewrite: use PipelineBoard, stage groups, analytics badges, adapter layer |
| `src/hooks/useSalesLeads.ts` | Update `SALES_STAGES` color format from hex to tailwind class names |

