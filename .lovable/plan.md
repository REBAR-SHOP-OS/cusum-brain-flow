
Goal: make customer contacts like Swapzero reliably appear in the Sales Pipeline “New Sales Lead” contact picker and auto-fill their info.

What I found:
- Swapzero does exist in the backend in `v_customers_clean` for the same company.
- The picker UI is driven by `useSalesContacts()` and rendered in `src/pages/sales/SalesPipeline.tsx`.
- Your screenshot and session replay show the search is running, but the dropdown returns “No contact found.”
- The live network request still shows `v_customers_clean?select=*&company_id=eq...` without the expected sorting/limit safeguards, which means the runtime path is still effectively truncating the large customer list before Swapzero is reached.

Plan:
1. Fix the customer fetch in `src/hooks/useSalesContacts.ts`
   - Keep `v_customers_clean` in the merged source list.
   - Make the customer query deterministic and safe for large datasets:
     - explicit descending sort on `created_at`
     - explicit high limit
   - Ensure the mapped customer row uses the best display field for search and selection:
     - `display_name`
     - fallback to `company_name`
     - fallback to `normalized_name`

2. Harden deduplication so customer-only companies are not dropped accidentally
   - Preserve manual > system > customer priority.
   - Also record customer names in the dedupe set after adding them, so behavior stays consistent.
   - Avoid collisions where blank/placeholder names like `—` can suppress valid customer entries.

3. Improve the picker search behavior in `src/pages/sales/SalesPipeline.tsx`
   - Keep using the command palette, but make the searchable value richer and normalized:
     - contact name
     - company name
     - email
     - lowercase/trim-safe matching
   - This ensures typing `swapzero` matches even when the visible name/company differs slightly.

4. Validate the contact autofill path
   - When selecting Swapzero from the dropdown, confirm these fields populate:
     - `contact_name`
     - `contact_company`
     - `contact_email`
     - `contact_phone`
   - If the customer has no phone, leave it blank without blocking selection.

5. Verify end-to-end in the Sales Pipeline
   - Open New Sales Lead
   - Search `swapzero`
   - Select it from the picker
   - Confirm the form is populated and the contact remains selectable on repeat opens

Technical notes:
- Files involved:
  - `src/hooks/useSalesContacts.ts`
  - `src/pages/sales/SalesPipeline.tsx`
- Root cause is not that Swapzero is missing from the database; it’s that the picker’s live data path is still incomplete/truncated for large customer datasets.
- No backend schema change should be needed for this fix.
