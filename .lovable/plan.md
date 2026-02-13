
# Audit & Improve Pipeline Search Box

## Current Issues

1. **Limited search scope**: Only searches `title` and `description` fields. Does not search by customer name, company name, source, or notes.
2. **No debounce**: Every keystroke triggers a new database query, causing unnecessary load.
3. **No client-side customer search**: Customer data (`customers.name`, `customers.company_name`) comes from a joined table and cannot be filtered in the same `.or()` clause on the `leads` table.
4. **Placeholder too vague**: Just says "Search..." with no hint of what fields are searchable.

## Changes

### File: `src/pages/Pipeline.tsx`

1. **Add debounced search**: Introduce a `debouncedSearch` state that updates 300ms after the user stops typing. Use this for the query key and DB filter instead of the raw `searchQuery`.

2. **Expand server-side search**: Add `source` and `notes` to the `.or()` filter:
   ```
   title.ilike.%query%, description.ilike.%query%, source.ilike.%query%, notes.ilike.%query%
   ```

3. **Add client-side customer filtering**: After fetching leads, apply an additional filter to include leads where `customers.name` or `customers.company_name` matches the search query -- since these are from a joined table and can't be filtered server-side in the same `.or()`.

4. **Update placeholder text**: Change from "Search..." to "Search leads, customers, source..."

### Technical Details

```text
New state:
  const [debouncedSearch, setDebouncedSearch] = useState("")

New useEffect for debounce:
  useEffect with 300ms setTimeout on searchQuery changes

Query changes:
  queryKey: ["leads", debouncedSearch]
  .or filter: title, description, source, notes (all ilike)

Post-fetch filter (inside queryFn, after collecting allLeads):
  If debouncedSearch is set, also include leads where
  customers.name or customers.company_name matches (case-insensitive)

Input placeholder: "Search leads, customers, source..."
```

### Result
- Searches across title, description, source, notes, customer name, and company name
- Fewer unnecessary DB calls thanks to debounce
- Better UX with descriptive placeholder
