

# Remove Brand Kit Icon from Timeline Toolbar

## Problem
The user wants to remove the highlighted icon (Brand Kit / Palette icon) from the timeline toolbar in the Ad Director editor.

## Fix
Remove the `brand-kit` entry from the `sidebarTabs` array in `ProVideoEditor.tsx` at line 1698.

## File Changed
- `src/components/ad-director/ProVideoEditor.tsx` — remove line 1698: `{ id: "brand-kit", label: "Brand", icon: <Palette className="w-3.5 h-3.5" /> },`

