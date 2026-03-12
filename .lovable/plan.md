

# Wire Up All Sidebar Tabs & Add Pexels Stock Items

## Problem
The sidebar's `onNavigateTab` callback isn't connected to the `ProVideoEditor`'s `activeTab` state, so clicking sidebar items like "Media Library", "Audio mixer", etc. does nothing. Also, the sidebar is missing dedicated "Stock Video" and "Stock Images" items that link to the Pexels-powered tabs already built in the editor.

## Changes

### 1. `src/pages/AdDirector.tsx`
- Add `activeEditorTab` state lifted to this level
- Pass `onNavigateTab` setter to `AdDirectorSidebar`
- Pass `externalActiveTab` + `onTabChanged` to `AdDirectorContent` → `ProVideoEditor`

### 2. `src/components/ad-director/AdDirectorContent.tsx`
- Accept `externalActiveTab` prop, forward it to `ProVideoEditor`

### 3. `src/components/ad-director/ProVideoEditor.tsx`
- Accept optional `externalActiveTab` prop
- `useEffect` to sync `activeTab` when `externalActiveTab` changes

### 4. `src/components/ad-director/AdDirectorSidebar.tsx`
- Add "Stock Video" and "Stock Images" to the PLUGINS section (tabs: `stock-video`, `stock-images`)
- Change "Preset library" disabled state to point to `templates` tab
- Wire all items through `onNavigateTab` instead of navigating away
- Highlight the currently active tab

This connects every sidebar item to an actual editor tab and surfaces the existing Pexels stock search (already functional via the `pexels-search` edge function) directly from the sidebar.

