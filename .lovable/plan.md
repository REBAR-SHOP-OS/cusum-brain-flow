

# Audit & Max-Tech Upgrade: All 4 Sales Department Modules

## Current State Assessment

| Module | Current State | Missing Tech |
|--------|--------------|-------------|
| **Pipeline** | Basic kanban, simple cards, no filters, no analytics, no detail drawer, no AI, no realtime, no search, no bulk actions | Everything the legacy /pipeline has |
| **Quotations** | Basic table + TakeoffWizard drop zone, no row click detail, no status transitions, no inline edit, no line items, no PDF generation from table, no search/filter | Detail view, status workflow, line items, search |
| **Invoices** | Bare table, create dialog only, no edit/delete, no status transitions, no payment tracking, no aging, no realtime, no search | Almost everything |
| **Contacts** | Merged view (system + manual), table only, no click-to-detail, no edit/delete, no search, no tags/labels, no activity history | Detail drawer, edit, search, enrichment |

## Upgrade Plan

### 1. Sales Pipeline — Full Feature Parity with Legacy Pipeline

**SalesPipeline.tsx** — Complete rewrite:
- **Rich lead cards**: Show priority stars, expected value, source badge, contact name, days-in-stage indicator, color-coded stage bar
- **Detail drawer** (new `SalesLeadDrawer.tsx`): Full lead detail with editable fields (stage, value, priority, contact info, notes), activity timeline, and delete action — slide-in sheet like the legacy `LeadDetailDrawer`
- **Analytics bar**: Pipeline value, weighted forecast, win rate, avg deal size (reuse pattern from `PipelineAnalytics`)
- **Search & filters**: Text search across title/contact/company, filter by stage/priority/source, "My Pipeline" toggle using `assigned_to`
- **Bulk actions**: Multi-select cards, bulk move stage, bulk delete
- **Drag-and-drop**: Use the same edge-scroll pattern from `PipelineBoard` for smooth horizontal scrolling
- **Realtime**: Already has realtime subscription in the hook — wire it properly
- **Activity status bar** per column (planned/today/overdue segments like legacy `PipelineColumn`)
- **Keyboard shortcuts**: `n` for new lead, `/` for search, `Esc` to close drawer

**DB migration**: Add columns to `sales_leads`:
- `last_activity_date timestamptz` — track staleness
- `tags text[]` — flexible tagging
- `lost_reason text` — capture why deals are lost

### 2. Quotations — Professional Quotation Management

**SalesQuotations.tsx** — Major upgrade:
- **Row click → Detail drawer** (`SalesQuotationDrawer.tsx`): View/edit all fields, change status with workflow buttons (Draft → Sent → Accepted/Declined/Expired), notes editor
- **Status workflow buttons**: "Mark as Sent", "Mark Accepted", "Mark Declined" — contextual based on current status
- **Line items table** (new `sales_quotation_items` DB table): item description, quantity, unit, unit price, total — editable inline
- **Search bar**: Filter by quotation number, customer name, status
- **Summary cards**: Total draft value, total sent value, conversion rate, average quote size
- **PDF preview**: Click to open `QuotationTemplate` preview (already imported in TakeoffWizard)
- **Duplicate quotation**: One-click to copy an existing quote as a new draft
- **Auto-number**: Already works, keep it
- **Link to lead**: Show linked sales_lead_id as a clickable badge

**DB migration**: Create `sales_quotation_items` table:
- `id uuid PK`, `quotation_id uuid FK`, `company_id uuid`, `description text`, `quantity numeric`, `unit text`, `unit_price numeric`, `total numeric`, `sort_order int`

### 3. Invoices — Full Invoice Lifecycle

**SalesInvoices.tsx** — Major upgrade:
- **Row click → Detail drawer** (`SalesInvoiceDrawer.tsx`): Edit all fields, status workflow (Draft → Sent → Paid/Overdue/Cancelled), payment date tracking, notes
- **Status workflow**: Context-sensitive action buttons per status
- **Auto-number generation**: Like quotations, auto-generate `INV-{YYYY}{0001}`
- **Summary cards**: Total outstanding, total paid, overdue count, average days to pay
- **Overdue detection**: Auto-flag invoices past due_date as "overdue" visually (client-side, no DB change needed)
- **Search & filter**: By invoice number, customer, status, date range
- **Link to quotation/lead**: Show linked `quotation_id` and `sales_lead_id` as clickable badges
- **Realtime**: Add realtime subscription to hook
- **Line items**: Reference same pattern as quotations — new `sales_invoice_items` table

**DB migration**: Create `sales_invoice_items` table (same structure as quotation items but with `invoice_id` FK). Add `paid_date date` and `payment_method text` to `sales_invoices`.

### 4. Contacts — CRM Contact Hub

**SalesContacts.tsx** — Major upgrade:
- **Click-to-detail drawer** (`SalesContactDrawer.tsx`): View all info, edit fields, see linked leads & quotations, notes, activity history
- **Search bar**: Filter by name, company, email, phone
- **Tags/labels**: Add `tags text[]` column — filter by tag
- **Edit & delete**: Inline edit for manual contacts, delete with confirmation
- **Contact card view** toggle: Switch between table and card grid view
- **Link indicators**: Show badge count of linked leads/quotes per contact
- **Quick actions**: Click email to open mailto, click phone to open tel:
- **Import from lead**: When creating a lead, auto-suggest creating a contact from the lead's contact info
- **Realtime**: Add realtime subscription

**DB migration**: Add `tags text[]`, `title text` (job title), `address text` to `sales_contacts`.

### 5. Sales Hub — Live KPIs

**SalesHub.tsx** — Enhance:
- Add live KPI badges on each card: Pipeline count, Quotation count, Invoice outstanding, Contact count
- Pulse indicator on cards with pending items (overdue invoices, stale leads)

### Implementation Order
1. DB migrations (all tables/columns at once)
2. Sales Pipeline (largest, most complex)
3. Quotations (line items, detail drawer)
4. Invoices (detail drawer, status workflow)
5. Contacts (detail drawer, search)
6. Sales Hub (KPI badges)

### Files to Create
- `src/components/sales/SalesLeadDrawer.tsx`
- `src/components/sales/SalesLeadCard.tsx`
- `src/components/sales/SalesQuotationDrawer.tsx`
- `src/components/sales/SalesInvoiceDrawer.tsx`
- `src/components/sales/SalesContactDrawer.tsx`
- `src/components/sales/SalesSearchBar.tsx`
- `src/components/sales/SalesSummaryCards.tsx`

### Files to Modify
- `src/pages/sales/SalesPipeline.tsx` — Full rewrite
- `src/pages/sales/SalesQuotations.tsx` — Major upgrade
- `src/pages/sales/SalesInvoices.tsx` — Major upgrade
- `src/pages/sales/SalesContacts.tsx` — Major upgrade
- `src/pages/sales/SalesHub.tsx` — Add KPIs
- `src/hooks/useSalesLeads.ts` — Add search/filter params
- `src/hooks/useSalesInvoices.ts` — Add realtime, auto-number
- `src/hooks/useSalesContacts.ts` — Add realtime, update/delete for system contacts
- `src/hooks/useSalesQuotations.ts` — Add line items support

