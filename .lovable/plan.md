

# Fix Delete Not Removing Email + Add Prominent Select/Select All

## Problem 1: Deleted email stays visible
The current delete flow uses `hiddenIds` to temporarily hide emails, but:
- Clicking any filter chip resets `hiddenIds` to empty, making deleted emails reappear until the next data refetch
- The detail view may not close reliably due to stale closure references

**Fix**: After successfully deleting from the database, also remove the item from `allEmails` by refetching communications data. Additionally, ensure `setSelectedEmail(null)` fires reliably by removing the stale `selectedEmail` dependency from `handleDeleteEmail`.

## Problem 2: No prominent Select / Select All
The selection mode toggle exists as a tiny icon in the toolbar. The user wants visible Select and Select All buttons.

**Fix**: Add a visible "Select" checkbox/button in the email list header area that is always visible (not just in selection mode), and a "Select All" checkbox that appears when selection mode is active.

---

## Technical Changes

### 1. `src/components/inbox/InboxView.tsx`

**Fix delete persistence:**
- In `handleDeleteEmail`: after the successful `supabase.from("communications").delete()` call, trigger a re-sync (`sync()`) so the item is permanently removed from the `communications` data source, not just hidden via `hiddenIds`
- Use functional `setSelectedEmail` to avoid stale closure: replace `if (selectedEmail?.id === id) setSelectedEmail(null)` with `setSelectedEmail(prev => prev?.id === id ? null : prev)`
- Apply the same fix to `handleArchiveEmail`, `handleBulkDelete`, and `handleBulkArchive`

**Add prominent Select/Select All in list view:**
- In the email count bar (line ~880), replace the current minimal layout with:
  - A checkbox that toggles selection mode (always visible)
  - When selection mode is active: "Select All" checkbox + count + Delete/Archive bulk actions
  - This replaces the tiny toolbar icon approach with inline controls in the list header

### 2. `src/components/inbox/InboxEmailList.tsx`
- Add a "Select All" checkbox row at the top of the email list when in selection mode (optional, since InboxView already has it in the header bar)

These changes ensure deleted emails are gone for good (not just hidden) and provide clear, accessible selection controls.
