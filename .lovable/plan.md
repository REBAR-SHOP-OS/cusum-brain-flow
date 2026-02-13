
# Customer Action Page from Agent Suggestions

## Problem
When clicking "Act" on agent suggestion cards (like overdue invoice alerts), users are taken to the generic accounting page. Instead, they should be taken to a **dedicated customer action page** showing the full customer history with quick action buttons.

## Solution

### 1. New Page: `/customer-action/:customerId`

Create a new page `src/pages/CustomerAction.tsx` that shows:

- **Customer header** with name, company, status, and contact info
- **Action buttons bar**: Call, Email, Schedule Activity
  - **Call**: Triggers the existing RingCentral WebRTC call flow using the customer's primary contact phone
  - **Email**: Opens a compose email dialog or mailto link for the primary contact
  - **Schedule Activity**: Opens a dialog to create a follow-up activity event (date picker + notes) saved to `activity_events`
- **History tabs** (reuses data patterns from `CustomerDetail`):
  - Orders (from `orders` table)
  - Quotes (from `quotes` table)
  - Communications (from `communications` table)
  - Invoices/AR (from `accounting_mirror` where `customer_id` matches)
  - Activity log (from `activity_events`)

### 2. Update `AgentSuggestionCard.tsx` — "Act" Button Logic

When "Act" is clicked on a suggestion with `entity_type === "invoice"`:

1. Look up the `accounting_mirror` record using `entity_id` to get the `customer_id`
2. Navigate to `/customer-action/{customer_id}` with the invoice context as a query param
3. Falls back to existing navigation behavior for non-invoice suggestions

### 3. Update Suggestion Generation — Fix "Unknown" Customer Names

The suggestion titles show "Unknown" because the generate-suggestions function doesn't resolve customer names. Update the `generate-suggestions` edge function to join `accounting_mirror.customer_id` with the `customers` table to include the customer name in the suggestion title (e.g., "NTL Contracting -- $155 overdue (3d)" instead of "Unknown -- $155 overdue (3d)").

### 4. Add Route in `App.tsx`

Register the new `/customer-action/:customerId` route.

### 5. Schedule Activity Dialog

A small dialog component (`ScheduleActivityDialog.tsx`) with:
- Date picker for follow-up date
- Activity type dropdown (Call, Email, Meeting, Follow-up)
- Notes text field
- Saves to `activity_events` table with `entity_type: "customer"`, `entity_id: customerId`

---

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/CustomerAction.tsx` | New page with customer history + action buttons |
| `src/components/customers/ScheduleActivityDialog.tsx` | New dialog for scheduling follow-up activities |
| `src/components/agent/AgentSuggestionCard.tsx` | Update "Act" to resolve customer from invoice and navigate to customer action page |
| `src/App.tsx` | Add `/customer-action/:customerId` route |
| `supabase/functions/generate-suggestions/index.ts` | Resolve customer names for suggestion titles |

## Data Flow

```text
AgentSuggestionCard "Act" click
  |
  +--> suggestion.entity_type === "invoice"?
  |      |
  |      +--> Fetch accounting_mirror by entity_id --> get customer_id
  |      |
  |      +--> Navigate to /customer-action/{customer_id}?invoice={entity_id}
  |
  +--> Other entity types: existing behavior (navigate to path in actions)

CustomerAction page
  |
  +--> Fetch customer from customers table
  +--> Fetch contacts, orders, quotes, communications, accounting_mirror, activity_events
  +--> Show action buttons: Call (WebRTC), Email (mailto/compose), Schedule (dialog)
```
