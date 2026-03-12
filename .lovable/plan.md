

# Fix Ad Director Sidebar — Make All Links Functional

## Problem
The sidebar links (Stock Images, Stock Video, Templates, Graphics, Transitions, Brand Kit, etc.) only render their content panels inside `ProVideoEditor`, which only appears at the "Preview" step. When the user is on the "Script & Assets" or "Storyboard" step, clicking sidebar items highlights them but shows nothing — the content panels are not wired to these steps.

The Pexels edge function works correctly (tested and confirmed), so the stock search itself is not broken — the issue is purely that the tab content panels are not rendered outside the editor.

## Plan

### 1. Add a floating side panel to `AdDirectorContent.tsx`
When `externalActiveTab` is set and the current step is NOT "preview" (where the editor handles it), render a slide-out panel on the left side that shows the appropriate tab content:

- `stock-images` → `<StockImagesTab />`
- `stock-video` → `<StockVideoTab />`
- `templates` → `<TemplatesTab />`
- `graphics` → `<GraphicsTab />`
- `transitions` → `<TransitionsTab />` (with default props)
- `brand-kit` → `<BrandKitTab />` (with brand/logo state)
- `text` → `<TextTab />` (with no-op handler)
- `record` → `<RecordTab />`
- `media` → placeholder "Select a project first"
- `music` → `<MusicTab />`
- `settings` → `<SettingsTab />`

The panel will appear as a floating card overlaying or beside the main content, with a close button (X) that resets `activeTab` to null.

### 2. Update `AdDirectorContent.tsx` — Add imports and panel rendering
- Import all tab components (StockImagesTab, StockVideoTab, etc.)
- Add a conditional render block before or alongside the main grid content
- When `step !== "preview" && externalActiveTab` is truthy, render a side panel with the matching tab component
- Add a close/dismiss button that calls `onActiveTabChanged?.(null)`

### 3. No backend changes needed
The `pexels-search` edge function and `PEXELS_API_KEY` are both working correctly.

