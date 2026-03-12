

# Move Brand Kit to Sidebar & Replace AI Engine with Video Parameters

## What Changes

### 1. Brand Kit → Sidebar Panel
When the user clicks "Brand kit" in the sidebar, a floating panel opens (already wired at line 869 of AdDirectorContent) showing the full Brand Kit form (name, website, tagline, audience, CTA, colors, save button). Currently it just shows a placeholder message.

**New file**: `src/components/ad-director/editor/BrandKitSidePanel.tsx` — extracts the Brand Kit form from ScriptInput into a reusable component that accepts `brand`, `onBrandChange`, `onSaveBrandKit`, `savingBrandKit` props.

**AdDirectorContent.tsx** (line 869): Replace the placeholder text with `<BrandKitSidePanel>` component, passing brand state + handlers.

### 2. Replace AI Engine with Video Parameters
In `ScriptInput.tsx` (lines 334-338), replace `<AdvancedModelSettings>` with a new `<VideoParameters>` component matching the reference image:
- **Ratio**: 21:9, 16:9, 4:3, 1:1, 3:4, 9:16, Smart (toggle buttons)
- **Resolution**: 480p, 720p, 1080p (segmented control)
- **Duration**: Seconds/Frames toggle + slider (2-30s) with numeric input
- **Build Quantity**: Slider (1-4 videos)

**New file**: `src/components/ad-director/VideoParameters.tsx`

### 3. Remove Brand Kit from ScriptInput main area
Remove lines 152-256 (the Brand Kit card) and lines 258-297 (Logo Upload card) from ScriptInput, since these now live in the sidebar panel. The right column will contain: Reference Assets + Video Parameters. Adjust grid from `lg:grid-cols-5` to `lg:grid-cols-1` (single column) since Brand Kit moves to sidebar.

### 4. Wire Video Parameters state
Add `videoParams` state to `AdDirectorContent` (ratio, resolution, duration, buildQty) and pass to ScriptInput + generation pipeline. The `aspectRatio` and `duration` values feed into `generateScene`.

### Files Changed
- `src/components/ad-director/editor/BrandKitSidePanel.tsx` — **new** (Brand Kit form extracted)
- `src/components/ad-director/VideoParameters.tsx` — **new** (ratio/resolution/duration/qty UI)
- `src/components/ad-director/ScriptInput.tsx` — remove Brand Kit section, add VideoParameters
- `src/components/ad-director/AdDirectorContent.tsx` — wire BrandKitSidePanel in sidebar panel, add videoParams state

### No Breaking Changes
- Brand Kit data flow unchanged (same `brand` state + `onBrandChange`)
- AI Engine (AdvancedModelSettings) stays importable but removed from default view
- Sidebar navigation already has "Brand kit" tab wired
- Logo upload moves into BrandKitSidePanel

