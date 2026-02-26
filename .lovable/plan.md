

## Add Selection & Bulk Delete to Tags & Export Session List

### What changes
Add checkboxes to each session row in the Tags & Export session list, a "Select All" checkbox, and a bulk delete bar that appears when items are selected.

### File: `src/components/office/TagsExportView.tsx`

1. **Add state** for `selectedIds: Set<string>` and `deleting: boolean`
2. **Add imports**: `Checkbox` from ui, `Trash2` from lucide, `toast` from sonner, `supabase` client
3. **Session list** (lines 133-160): Add a `Checkbox` to each session row, and a "Select All / Deselect All" + "Delete Selected" toolbar above the list
4. **Delete handler**: Delete from `extract_sessions` table by IDs, then call `refresh()` and show toast
5. **Bulk action bar**: Fixed bottom bar (using `PipelineBulkBar` pattern with `AnimatePresence`) showing count + Delete + Clear buttons

### Implementation detail

**Above the session list (after the subtitle text):**
```tsx
<div className="flex items-center gap-2">
  <Checkbox
    checked={selectedIds.size === availableSessions.length && availableSessions.length > 0}
    onCheckedChange={(checked) => {
      if (checked) setSelectedIds(new Set(availableSessions.map(s => s.id)));
      else setSelectedIds(new Set());
    }}
  />
  <span className="text-xs text-muted-foreground">Select All</span>
  {selectedIds.size > 0 && (
    <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting}>
      <Trash2 className="w-3.5 h-3.5 mr-1" />
      Delete {selectedIds.size}
    </Button>
  )}
</div>
```

**Each session row** gets a `Checkbox` on the left that toggles selection without navigating into the session.

**Delete handler:**
```tsx
const handleBulkDelete = async () => {
  setDeleting(true);
  const { error } = await supabase
    .from("extract_sessions")
    .delete()
    .in("id", Array.from(selectedIds));
  if (error) toast.error(error.message);
  else {
    toast.success(`Deleted ${selectedIds.size} session(s)`);
    setSelectedIds(new Set());
    refresh();
  }
  setDeleting(false);
};
```

### No DB changes needed
Uses existing `extract_sessions` table with existing RLS policies.

