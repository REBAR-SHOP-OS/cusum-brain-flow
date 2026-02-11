
## Add Vendor List to Accounting Workspace

### Problem
The Vendors dropdown menu has no "Vendors" list page. There's no way to see all vendors. The data is already being fetched (`list-vendors` in `useQuickBooksData`), it just needs a UI component and a nav link.

### What Will Change

**1. New file: `src/components/accounting/AccountingVendors.tsx`**
- A vendor list component matching the same style as `AccountingCustomers.tsx`
- Search bar to filter by name or company
- Table with columns: Name, Company, Phone, Email, Balance, Status
- Sorted alphabetically by `DisplayName` (case-insensitive)
- Enriched with bill stats (open balance, overdue count) from `data.bills`

**2. Update: `src/components/accounting/AccountingNavMenus.tsx`**
- Add "Vendors" menu item to the Vendors dropdown (alongside Bills and Vendor Payments)

**3. Update: `src/pages/AccountingWorkspace.tsx`**
- Import `AccountingVendors`
- Add rendering for `activeTab === "vendors"`
