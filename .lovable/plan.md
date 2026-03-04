

# Add Contacts & Projects Tabs to Customer Detail

## Problem

The Customer Detail sheet only has 4 tabs: Transaction List, Customer Details, Notes, Activity. There's no way to see the **contacts (people)** or **projects** linked to this company. The user expects the hierarchy: **Company → Contacts → Projects**.

## Current Data State

For "Kingdom Construction Limited" (id: `a7aec8da-...`), the `contacts` table has 4 entries (Ben McCabe, Canberk Turkmen, etc.) linked via `customer_id`. The `projects` table has a `customer_id` FK. Both tables are ready to query.

## Plan

### 1. Add "Contacts" tab to CustomerDetail

Query the `contacts` table filtered by `customer_id = customer.id` and display a list showing:
- Name (first + last)
- Role
- Email + Phone
- Primary badge
- Count in tab label

### 2. Add "Projects" tab to CustomerDetail

Query the `projects` table filtered by `customer_id = customer.id` and display:
- Project name
- Status badge
- Site address
- Count in tab label

### File Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Add 2 new queries (contacts, projects), 2 new TabsTrigger entries, 2 new TabsContent sections |

No database changes needed — both tables already have the correct FKs and data.

