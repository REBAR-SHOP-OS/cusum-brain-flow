

# Fix: Address Not Showing on Rebar Tags

## Root Cause
The `site_address` field on `extract_sessions` is `NULL` for all recent sessions — users aren't filling it in during extraction. However, project addresses DO exist in the `projects` table, linked via `barlists.extract_session_id → barlists.project_id → projects.site_address`.

The current fallback chain is: `row.address → session.site_address → ""` — both are null, so nothing shows.

## Fix: Add Project Address as Final Fallback

### 1. `src/components/office/TagsExportView.tsx`
- After fetching `selectedSession`, also query the project address:
  ```
  barlists (where extract_session_id = sessionId) → project_id → projects.site_address
  ```
- Store in `projectAddress` state
- Update address prop: `address={row.address || session.site_address || projectAddress || ""}`

### 2. `src/pages/PrintTags.tsx`
- Same query: look up `barlists` by `extract_session_id`, then `projects.site_address`
- Use as fallback after `sessionAddress`: `address={row.address || sessionAddress || projectAddress || ""}`

### 3. No changes to `RebarTagCard.tsx`
The component already renders the address correctly when it receives a non-empty string.

## Fallback Chain (after fix)
```text
row.address → session.site_address → project.site_address → ""
```

## Files Changed
- `src/components/office/TagsExportView.tsx` — add project address lookup
- `src/pages/PrintTags.tsx` — add project address lookup

