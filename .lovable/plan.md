

## New Sales Department — Parallel Workspace

### Overview
Create a completely isolated "Sales Department" section with its own tables, pages, and sidebar group. The existing pipeline (`/pipeline`) stays untouched.

---

### 1. Database — 4 New Tables

**`sales_leads`** — New pipeline leads (isolated from `leads`)
- `id`, `company_id`, `title`, `description`, `stage` (default `'new'`), `probability`, `expected_value`, `expected_close_date`, `source`, `assigned_to`, `priority`, `notes`, `contact_name`, `contact_email`, `contact_phone`, `contact_company`, `metadata` (jsonb), `created_at`, `updated_at`
- RLS: company_id scoped, authenticated only
- Add to `supabase_realtime`

**`sales_quotations`**
- `id`, `company_id`, `quotation_number` (text, unique), `customer_name`, `customer_company`, `sales_lead_id` (FK → sales_leads), `status` (draft/sent/accepted/declined/expired), `amount`, `notes`, `created_at`, `expiry_date`
- RLS: company_id scoped

**`sales_invoices`**
- `id`, `company_id`, `invoice_number` (text, unique), `customer_name`, `customer_company`, `quotation_id` (FK → sales_quotations nullable), `sales_lead_id` (FK → sales_leads nullable), `amount`, `status` (draft/sent/paid/overdue/cancelled), `due_date`, `issued_date`, `notes`, `created_at`
- RLS: company_id scoped

**`sales_contacts`**
- `id`, `company_id`, `name`, `company_name`, `email`, `phone`, `source`, `notes`, `created_at`, `updated_at`
- RLS: company_id scoped

---

### 2. Sidebar — New "Sales" Group

Add a new nav group between CRM and Operations in `Sidebar.tsx`:

```text
── CRM (existing) ──
  Home, Tasks, Phonecalls, Pipeline, Customers
── Sales Department (NEW) ──
  Sales Pipeline   → /sales/pipeline
  Quotations       → /sales/quotations
  Invoices         → /sales/invoices
  Contacts         → /sales/contacts
── Operations (existing) ──
```

Icons: `Kanban`, `FileText`, `Receipt`, `UserPlus`

---

### 3. Routes — 4 New Routes in `App.tsx`

```
/sales/pipeline    → SalesPipeline
/sales/quotations  → SalesQuotations
/sales/invoices    → SalesInvoices
/sales/contacts    → SalesContacts
```

All wrapped in `<ProtectedRoute>`.

---

### 4. Pages — 4 New Files

**`src/pages/sales/SalesPipeline.tsx`**
- Reuses `PipelineBoard` and `PipelineColumn` components
- Own sales-focused stages: New → Contacted → Qualified → Estimating → Quote Sent → Follow Up → Won → Lost
- Queries `sales_leads` table (not `leads`)
- Lead create/edit modal, drag-drop stage changes, detail drawer
- Realtime subscription on `sales_leads`

**`src/pages/sales/SalesQuotations.tsx`**
- Table view with columns: number, customer, linked lead, status, amount, created, expiry
- Empty state with "Create Quotation" button
- CRUD modals

**`src/pages/sales/SalesInvoices.tsx`**
- Table view: number, customer, linked quotation/lead, amount, status, due date, issued date
- Empty state with "Create Invoice" button
- CRUD modals

**`src/pages/sales/SalesContacts.tsx`**
- Table view: name, company, email, phone, source, notes, linked leads count, last activity
- Empty state with "Add Contact" button
- CRUD modals

---

### 5. Hooks — New Data Hooks

- `useSalesLeads` — fetch/mutate `sales_leads`, realtime subscription
- `useSalesQuotations` — fetch/mutate `sales_quotations`
- `useSalesInvoices` — fetch/mutate `sales_invoices`
- `useSalesContacts` — fetch/mutate `sales_contacts`

---

### 6. Old Pipeline Preservation

- Zero changes to `/pipeline`, `leads` table, or any existing pipeline components
- The existing "Pipeline" link in sidebar CRM group stays as-is
- Optionally rename sidebar label to "Pipeline (Legacy)" only if explicitly requested later

---

### 7. Files Summary

| Action | Files |
|--------|-------|
| **New DB tables** | `sales_leads`, `sales_quotations`, `sales_invoices`, `sales_contacts` (migration) |
| **New pages** | `src/pages/sales/SalesPipeline.tsx`, `SalesQuotations.tsx`, `SalesInvoices.tsx`, `SalesContacts.tsx` |
| **New hooks** | `src/hooks/useSalesLeads.ts`, `useSalesQuotations.ts`, `useSalesInvoices.ts`, `useSalesContacts.ts` |
| **Modified** | `src/App.tsx` (routes), `src/components/layout/Sidebar.tsx` (nav group) |
| **Untouched** | All existing pipeline code, `leads` table, current CRM pages |

