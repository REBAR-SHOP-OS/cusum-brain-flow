

# Show Leads/Opportunities in the Projects Tab

## Problem

The "Projects" tab for Kingdom Construction Limited shows empty because the `projects` table has no entries for this customer. However, the `leads` table has 20+ entries (imported from Odoo CRM) like "FW: Thamesford WWTP Upgrades", "Lucan WWTP Expansion", etc. These are the actual project-level records the user expects to see.

## Plan

### Update CustomerDetail Projects tab to also show Leads

In `src/components/customers/CustomerDetail.tsx`:

1. **Add a query for leads** linked to this customer (`leads.customer_id = customer.id`)
2. **Display both** projects and leads in the Projects tab:
   - Show projects from `projects` table (if any exist)
   - Show leads/opportunities from `leads` table with title, stage badge, expected value, and priority
3. **Update the tab count** to include both projects + leads
4. The tab label stays "Projects" but renders two sections: "Projects" and "Opportunities/Leads"

### Data available per lead

- `title` (e.g., "FW: Thamesford WWTP Upgrades")
- `stage` (e.g., "quotation_bids", "lost")
- `expected_value`, `probability`
- `priority`, `source`
- `created_at`

### Files Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Add leads query, render leads list in Projects tab alongside projects |

