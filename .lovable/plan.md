

## Add "Clear All" to Brain Page

### What This Does
Adds a "Clear All" button to the Brain page header that deletes all knowledge items for the user's company. Includes a confirmation dialog to prevent accidental deletion.

### Changes

**1. `src/pages/Brain.tsx`**
- Add a "Clear All" button (with Trash2 icon) next to existing header buttons
- Add an AlertDialog for confirmation ("Are you sure? This will permanently delete all X items.")
- On confirm: call `supabase.from("knowledge").delete().eq("company_id", companyId)` directly (no edge function needed since RLS already protects the table)
- After deletion: invalidate the `["knowledge"]` query to refresh the UI
- Show success/error toast

**2. Add `useCompanyId` hook import** (already exists in codebase)
- Used to scope the delete to the current company

### Technical Details

| Detail | Value |
|--------|-------|
| Table | `knowledge` |
| Delete scope | All rows matching `company_id` |
| Protection | RLS on table + AlertDialog confirmation |
| No edge function needed | Direct client delete with RLS is sufficient |

### UI Flow
1. User clicks "Clear All" button (red/destructive style)
2. AlertDialog appears: "Delete all brain items? This will permanently remove all {count} items. This action cannot be undone."
3. User confirms -> all items deleted -> toast "All brain items cleared" -> grid refreshes to empty state
4. User cancels -> nothing happens
