

# Fix: Projects/Leads Not Filtering by Contact

## Problem

When "All" is selected, `activeCustomerId = customer.id` (the parent company record). But projects for Canberk (3) and Ben (7) are linked to their **comma-name child customer IDs** (e.g., `e02ae804`, `3aff2a4a`), not the parent ID. So the projects query returns 0 results for "All", and contact-specific filtering also fails if the contact's `customer_id` doesn't match.

## Fix

Instead of using a single `activeCustomerId`, use the **same `allIds` array** from the contacts query for the "All" view, and the contact's specific `customer_id` for a selected contact.

### Changes to `src/components/customers/CustomerDetail.tsx`

1. **Extract `allIds` from contacts query** — store the computed `allIds` array (parent + map + comma-children) as a separate piece of state or return it alongside contacts, so it can be reused by projects/leads queries.

2. **Update projects query** (line ~247):
   - When no contact selected ("All"): `.in("customer_id", allRelatedIds)` — shows all 10 projects (3 + 7)
   - When contact selected: `.eq("customer_id", selectedContact.customer_id)` — shows only that person's projects

3. **Update leads query** (line ~261): Same pattern — use `.in()` for "All", `.eq()` for specific contact.

### Implementation Detail

```typescript
// Return allIds from the contacts query alongside contacts
const { data: contactsData } = useQuery({
  queryKey: ["customer_contacts_all", customer.id],
  queryFn: async () => {
    // ... existing allIds computation ...
    return { contacts: filteredContacts, relatedIds: allIds };
  },
});
const allContacts = contactsData?.contacts ?? [];
const allRelatedIds = contactsData?.relatedIds ?? [customer.id];

// Projects query — use allRelatedIds or specific contact's customer_id
const activeIds = selectedContact 
  ? [selectedContact.customer_id] 
  : allRelatedIds;

const { data: customerProjects = [] } = useQuery({
  queryKey: ["customer_projects", activeIds],
  queryFn: async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .in("customer_id", activeIds)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
});

// Same pattern for leads query
```

### File Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Return `allIds` from contacts query; use `.in()` for All view, `.eq()` for specific contact on projects + leads |

