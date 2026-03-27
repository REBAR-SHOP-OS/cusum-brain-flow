

# Remove Text Icon from Timeline Toolbar

## What
Remove the "Text" tab (Type icon) from the timeline toolbar, as indicated by the red circle in the screenshot.

## Change

### `src/components/ad-director/ProVideoEditor.tsx` (~line 1576)
Remove this entry from the `sidebarTabs` array:
```
{ id: "text", label: "Text", icon: <Type className="w-3.5 h-3.5" /> },
```

Clean up the `Type` import from lucide-react if unused elsewhere.

## Files changed
- `src/components/ad-director/ProVideoEditor.tsx`

