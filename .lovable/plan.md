

# Add Related Entities Bar to Sales Lead Drawer

## What
Add a horizontal summary bar at the top of the Sales Lead Drawer (below the stage ribbon, above the info grid) showing counts and totals for related Quotations, Invoices, and Orders — similar to Odoo's smart buttons (circled in the screenshot).

## How

### New component: `src/components/sales/LeadSmartButtons.tsx`

A compact row of clickable stat buttons that queries:
- **Quotations**: `sales_quotations` where `sales_lead_id = lead.id` → show count + total amount
- **Orders**: `orders` where `lead_id = lead.id` → show count + total amount  
- **Invoices**: `sales_invoices` where `sales_lead_id = lead.id` → show count + total amount

Each button shows an icon, count, label, and dollar total. Clicking a button could expand a small inline list or navigate — initially just display counts.

Uses 3 lightweight queries with `useQuery` keyed by `lead.id`.

### Update: `src/components/sales/SalesLeadDrawer.tsx`

Insert `<LeadSmartButtons leadId={lead.id} />` between the stage ribbon (line 137) and the info grid (line 141).

## Visual Design
```text
┌─────────────┬──────────────┬──────────────┐
│ 📋 Quotes 2 │ 📦 Orders 1  │ 📄 Invoices 1│
│  $83,252.10  │   $41,500    │   $41,500    │
└─────────────┴──────────────┴──────────────┘
```

## Files Changed
- `src/components/sales/LeadSmartButtons.tsx` — new component
- `src/components/sales/SalesLeadDrawer.tsx` — import and render it

