

# Replace Contact Cards with Dropdown + Filtered Projects

## Problem

The Contacts tab currently shows contact cards that open a nested sheet. The user wants a **dropdown selector** of contacts instead, and when a contact is selected, it should display that person's projects/leads below the dropdown — all inline, no nested sheets.

## Plan

### Changes to `src/components/customers/CustomerDetail.tsx`

1. **Replace contact card list with a `Select` dropdown** in the Contacts tab
   - Each option shows the contact name + role
   - Selecting a contact sets `selectedContactId` state

2. **Show selected contact's info + their projects below the dropdown**
   - Display the selected contact's email, phone, role as a small info card
   - Query leads from `leads` table filtered by the contact's `customer_id` (the child customer record)
   - Render those leads/projects inline below the contact info

3. **Remove the nested CustomerDetail sheet** — no longer needed since the projects show inline

4. **Remove `ChevronRight` icon import** if no longer used elsewhere

### UI Layout (Contacts tab)

```text
┌────────────────────────────────────┐
│ [▼ Select a contact...           ] │  ← Select dropdown
├────────────────────────────────────┤
│ 👤 Ben McCabe                      │  ← Contact info card
│    ben@kingdom.ca  ·  519-555-1234 │
├────────────────────────────────────┤
│ PROJECTS / LEADS                   │
│ ┌────────────────────────────────┐ │
│ │ Thamesford WWTP Upgrades      │ │  ← Leads for this contact's customer_id
│ │ quotation_bids  · $120,000    │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ Lucan WWTP Expansion          │ │
│ │ won  · $85,000                │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

### State & Data Flow

- `selectedContactId` — tracks which contact is selected in the dropdown
- When selected, use the contact's `customer_id` to query `leads` table: `.from("leads").select("*").eq("customer_id", contact.customer_id)`
- Also query `projects` table with same `customer_id`

### Files Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Replace contact cards with Select dropdown, show contact info + their leads/projects inline, remove nested sheet |

