

# Move Sidebar Tab Icons to Timeline Header

## Problem
The left sidebar has a vertical strip of 6 tab icons (My Media, Text, Music, Script, Brand Kit, Card Editor) plus a collapse toggle. The user wants these icons moved to the timeline toolbar area (between "TIMELINE 0:00 / 0:31" and the zoom buttons) and removed from the left sidebar.

## Changes

### `src/components/ad-director/editor/TimelineBar.tsx`
- Accept new props: `tabs`, `activeTab`, `onTabSelect` for the editor tab icons
- In the toolbar row (line 190), insert the tab icon buttons between the time display and the zoom controls (where `<div className="flex-1" />` is)

### `src/components/ad-director/ProVideoEditor.tsx`
- **Remove** the icon strip `<div>` (lines 1053-1072) that renders the vertical tab buttons and collapse toggle
- **Remove** the collapse toggle logic from the sidebar — the sidebar now always shows content or is hidden based on active tab
- Pass `TABS`, `activeTab`, and `handleSetActiveTab` as props to `<TimelineBar>`
- Adjust sidebar width logic: instead of collapsed/expanded via icon strip, toggle content visibility based on whether a tab is active (clicking same tab again hides sidebar content)

### Layout adjustment
- Left sidebar no longer has the 12px icon strip column — it only shows tab content panel (w-60) when a tab is selected, or nothing (w-0) when deselected
- The icon strip in timeline toolbar will be horizontal small buttons matching existing toolbar style

| File | Change |
|---|---|
| `TimelineBar.tsx` | Add tab icon buttons to toolbar header row |
| `ProVideoEditor.tsx` | Remove left icon strip, pass tab data to TimelineBar, adjust sidebar toggle logic |

