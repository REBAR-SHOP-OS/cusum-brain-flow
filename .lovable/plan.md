

# Remove Three Toolbar Icons from Timeline

## What
Remove the three circled icons from the timeline toolbar: **Script**, **Brand Kit**, and **Card Editor**.

## Changes

### File: `src/components/ad-director/ProVideoEditor.tsx` (~line 1560-1562)

Remove these three entries from the `sidebarTabs` array:
- `{ id: "script", label: "Script", icon: <FileText /> }`
- `{ id: "brand-kit", label: "Brand Kit", icon: <Palette /> }`
- `{ id: "card-editor", label: "Card", icon: <LayoutGrid /> }`

The remaining tabs will be: Media, Text, Music, Voice, Subtitle.

Unused imports (`FileText`, `Palette`, `LayoutGrid`) can also be cleaned up if no longer referenced elsewhere.

## Files changed
- `src/components/ad-director/ProVideoEditor.tsx` — remove 3 sidebar tab entries

