

# Add Per-Group "Select All" Toggle in Pages Sub-Panel

## Problem
Currently there's one global "Select All" button. User wants each platform group (Facebook, Instagram, LinkedIn) to have its own independent "Select All" toggle.

## Solution

### File: `src/components/social/SelectionSubPanel.tsx`

**In `renderGrouped()`** — Add a per-group "Select All" button inside each group header:

```typescript
const renderGrouped = () => {
  if (!groups || groups.length === 0) return renderFlat();

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const groupValues = group.options.map(o => o.value);
        const allGroupSelected = groupValues.every(v => currentMulti.includes(v));

        const toggleGroup = () => {
          if (allGroupSelected) {
            setCurrentMulti(prev => prev.filter(v => !groupValues.includes(v)));
          } else {
            setCurrentMulti(prev => [...new Set([...prev, ...groupValues])]);
          }
        };

        return (
          <div key={group.label} className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3.5 py-2.5 bg-muted/60 border-b flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <button onClick={toggleGroup} className="text-xs font-medium ...">
                <CheckCheck /> {allGroupSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            {group.options.map(...)}
          </div>
        );
      })}
    </div>
  );
};
```

The global "Select All" at the top remains for selecting everything across all groups.

## Files Changed
- `src/components/social/SelectionSubPanel.tsx` — add per-group select/deselect toggle in group headers

