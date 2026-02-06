
# CUSUM Full Implementation Plan

## Mission
Replace Odoo with CUSUM for operations while keeping QuickBooks as the financial source of truth. CUSUM mirrors QuickBooks data as read-only and acts as the operational truth, with Gmail and RingCentral serving as the communication truth. AI provides drafts only; humans must approve all risky actions.

---

## Current State (What's Built)

| Component | Status |
|-----------|--------|
| Auth (Login/Signup) | Done |
| App Layout & Sidebar | Done |
| Database Schema (13 tables) | Done |
| Gmail Edge Functions | Done (debugging OAuth) |
| Email UI (List/Viewer/Compose) | Done |
| Agent Chat UI (demo mode) | Done |
| Integrations Page (static) | Done |
| Brain/Knowledge Page (placeholder) | Done |

**Database Tables Already Created:**
- customers, contacts, tasks, quotes, orders, work_orders
- deliveries, delivery_stops, accounting_mirror
- events, communications, knowledge, integration_settings

---

## 8-Phase Roadmap

### Phase 0: Foundation & UI
**Status: COMPLETE**
- Authentication with email/password
- Protected routes and session management
- Sidebar navigation (Inbox, Brain, Integrations, Settings)
- Dark theme with agent color coding

---

### Phase 1: Comms to Tasks
**Status: IN PROGRESS**

**1.1 Gmail Integration (Current Focus)**
- Edge functions for sync/send (built, debugging OAuth)
- Store emails in `communications` table
- Link emails to customers via email-address matching

**1.2 Email to Task Conversion**
- "Create Task" button in EmailViewer
- Modal to set title, priority, due date, assign agent type
- Insert into `tasks` table with `source='email'` and `source_ref=message_id`

**1.3 Task List View**
- New `/tasks` page showing all tasks
- Filter by status, priority, agent type
- Link back to source email/communication

---

### Phase 2: CRM Context
**Goal:** Show customer context alongside communications

**2.1 Customer Management**
- `/customers` page with list/detail views
- CRUD operations for customers and contacts
- Auto-match incoming emails to customers by email domain

**2.2 Customer 360 Panel**
- When viewing email/task, show sidebar with:
  - Customer info (name, company, status)
  - Recent communications
  - Open tasks
  - AR balance (from accounting_mirror)
  - Recent orders/quotes

**2.3 Contact Linking**
- Link contacts to customers
- Track primary contact per customer

---

### Phase 3: QuickBooks Mirror
**Goal:** Read-only sync of financial data from QuickBooks

**3.1 QuickBooks OAuth Setup**
- Edge function for OAuth callback
- Store tokens securely in secrets
- Periodic token refresh

**3.2 Data Sync Edge Functions**
- `qb-sync-customers`: Sync QB customers to `customers` table (match by `quickbooks_id`)
- `qb-sync-invoices`: Sync invoices to `accounting_mirror`
- `qb-sync-payments`: Track payment status

**3.3 AR Display**
- Show customer balance in Customer 360
- Collections agent can query overdue balances
- Aging buckets (current, 30, 60, 90+ days)

---

### Phase 4: Sales Agent (AI-Powered)
**Goal:** AI assists with quotes and follow-ups

**4.1 Quote Management**
- `/quotes` page with list/detail views
- Create quote from customer context
- Line items with pricing and margin calculation

**4.2 Sales Agent Features**
- Analyze open quotes needing follow-up
- Draft follow-up emails (human approval required)
- Margin guardrail alerts (flag if below threshold)
- Convert approved quote to order

**4.3 Agent Chat Integration**
- Connect agent chat to real data
- Sales agent queries customers, quotes, orders
- Responses based on actual database state

---

### Phase 5: Shop Floor UI
**Goal:** Production management for manufacturing

**5.1 Work Order Management**
- `/work-orders` page
- Create work orders from orders
- Assign to workstations/employees
- Status tracking (pending, in-progress, complete)

**5.2 Shop Floor View**
- Simplified mobile-friendly interface
- Start/stop work timer
- Mark work order complete
- Capture notes/issues

**5.3 Order-to-Production Flow**
- Order creates work orders
- Track production against customer required date
- Flag at-risk deliveries

---

### Phase 6: Delivery UI
**Goal:** Route planning and proof of delivery

**6.1 Delivery Management**
- `/deliveries` page
- Create delivery runs with multiple stops
- Assign driver and vehicle
- Optimize stop sequence

**6.2 Driver Mobile View**
- List of today's stops
- Navigation integration
- Mark arrival/departure times

**6.3 Proof of Delivery**
- Signature capture
- Photo upload (storage bucket)
- Exception handling (partial delivery, refused, etc.)

**6.4 Customer Notifications**
- Email/SMS when delivery en route
- Delivery confirmation with POD

---

### Phase 7: Agent Expansion
**Goal:** Enable all 5 agents with real functionality

**7.1 Accounting Agent**
- Query QB mirror data
- Identify sync discrepancies
- Draft collection follow-ups

**7.2 Support Agent**
- Track support tickets (extend tasks table or new table)
- Link to orders/deliveries for context
- Draft customer responses

**7.3 Collections Agent**
- AR aging analysis
- Payment reminder sequences
- Flag credit-hold customers

**7.4 Estimation Agent**
- Job costing worksheets
- Material price lookups
- Margin calculations

**7.5 Agent Memory & Context**
- Use `knowledge` table for agent context
- Store customer preferences, pricing rules
- RAG-style retrieval for agent responses

---

### Phase 8: Odoo Removal
**Goal:** Full operational independence from Odoo

**8.1 Data Migration**
- Export all Odoo data
- Import into CUSUM tables
- Validate data integrity

**8.2 Process Cutover**
- Parallel run period
- Train users on new workflows
- Sunset Odoo access

**8.3 RingCentral Integration**
- Sync calls and SMS to `communications`
- Click-to-call from customer context
- Log call notes

---

## Technical Architecture

```text
+------------------+     +------------------+     +------------------+
|    Frontend      |     |   Edge Functions |     |    External      |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  React + Vite    |---->|  gmail-sync      |---->|  Gmail API       |
|  Tailwind CSS    |     |  gmail-send      |     |                  |
|  React Query     |     |  qb-sync-*       |---->|  QuickBooks API  |
|                  |     |  ai-agent        |---->|  Lovable AI      |
+--------+---------+     +--------+---------+     +------------------+
         |                        |
         v                        v
+--------------------------------------------------+
|                   Supabase                       |
+--------------------------------------------------+
|  PostgreSQL (13 tables)                          |
|  Auth (email/password)                           |
|  Storage (POD photos, documents)                 |
|  Realtime (live updates)                         |
+--------------------------------------------------+
```

---

## Agent Guardrails (All Phases)
- AI agents can **read** memory and **draft** actions
- Agents are **prohibited** from:
  - Sending emails without human approval
  - Moving money or processing payments
  - Approving their own drafted tasks
- All important actions logged in `events` table
- Humans review and approve via "Approve/Reject" UI

---

## Immediate Next Steps

1. **Fix Gmail OAuth** - Resolve the `unauthorized_client` error
2. **Store emails in database** - Save synced emails to `communications` table
3. **Email-to-Task flow** - Add "Create Task" button in EmailViewer
4. **Tasks page** - Build `/tasks` with list and filters

---

## Scope Exclusions (Do NOT Build)
Per project constraints:
- HR / Payroll
- Marketing automation
- Fleet management
- eLearning / Training
- Appraisals / Performance reviews
- Rentals

Focus remains strictly on **operations and sales**.
