

# Move Contact Dropdown to Header & Filter All Tabs

## What's Changing

The contact dropdown moves from the Contacts tab up to the **header area** (between the badges and the financial summary card). When a contact is selected, ALL tabs show data filtered for that person. An "All — Company Name" option lets users see unfiltered company-wide data.

## Changes to `src/components/customers/CustomerDetail.tsx`

### 1. Add contact dropdown in header (after badges, line ~476)
- Add a `Select` dropdown with `Users` icon
- First option: "All — {company name}" (resets to company-wide view)
- Other options: each contact name + role
- Show selected contact's email/phone inline next to dropdown

### 2. Use `activeCustomerId` to drive all tab queries
- Create a computed `activeCustomerId`: if a contact is selected, use `selectedContact.customer_id`; otherwise use `customer.id`
- Update these queries to use `activeCustomerId`:
  - `customerProjects` query (line ~247): `.eq("customer_id", activeCustomerId)`
  - `customerLeads` query (line ~261): `.eq("customer_id", activeCustomerId)`
  - Transactions query already uses `quickbooks_id` which is fine for company-level

### 3. Remove Contacts tab content (lines 975-1062)
- Replace the entire Contacts tab body with a simple message: "Use the contact selector above to filter by person"
- Or remove the Contacts tab trigger entirely since the dropdown is now in the header

### 4. Remove the Contacts tab
- Remove the `TabsTrigger` for "contacts" (line 668-670)
- Remove the `TabsContent` for "contacts" (lines 975-1062)
- The contact selection is now fully handled by the header dropdown

### UI Result

```text
┌──────────────────────────────────────────────┐
│ KC  Kingdom Construction Limited    Edit  New│
│     archived_odoo_only  business  net30      │
│     👥 [▼ Ben McCabe — PM ]  📧 ben@k..  📱 │
│                              ┌───────────────┤
│                              │ FINANCIAL ...  │
├──────────────────────────────┴───────────────┤
│ Transaction List │ Customer Details │ Notes │ │
│ Projects │ Activity                          │
├──────────────────────────────────────────────┤
│ (tabs content filtered for Ben McCabe)       │
└──────────────────────────────────────────────┘
```

### Files Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Move contact dropdown to header, compute `activeCustomerId`, filter Projects/Leads tabs, remove Contacts tab |

