

# AI Video Director — Audit & Polish Pass

## Critical Bug Found

The Quick Start card **never appears**. `AdDirectorContent` initializes `script` with `DEMO_SCRIPT`, so `!script.trim()` in `ScriptInput` is always false. The prominent onboarding card from the redesign is dead code.

## Issues by Priority

### 1. Dead Quick Start (Bug)
- Script state initializes to `DEMO_SCRIPT` → Quick Start card never renders
- Fix: Initialize `script` to `""`. Show Quick Start card. Let user explicitly load demo.

### 2. Step 1 — ScriptInput Polish
- **Brand color preview missing**: Two tiny color pickers with no visual preview of how they work together. Add a small brand preview strip (name on primaryColor background).
- **Logo upload stores blob URL only**: `URL.createObjectURL(file)` works for preview but won't survive page refresh or be usable in the edge function pipeline. This is a latent bug but not blocking for now — note it.
- **Script textarea placeholder is generic when demo is loaded**: After loading demo, the textarea has content but no guidance on what to do next. Add a subtle "tip" below textarea: "Edit the script above or proceed to analyze →".
- **Word/duration counters invisible when script is empty**: They hide when `!script.trim()`. Acceptable.

### 3. Step 2 — Storyboard Density
- **SceneCard is information-dense**: Shot type, camera, tone, objective, prompt, quality score, intelligence bar — 7+ elements per card. Target user is a busy founder.
- Fix: Collapse visual details (shot/camera/tone) into a "Details" expandable. Show only: scene number, time range, prompt (truncated), quality badge, status, and thumbnail.
- **SceneIntelligenceBar too technical**: "Planned: Gemini Pro → Written: GPT-5 → Render: Wan 2.6" means nothing to a marketer.
- Fix: Hide intelligence bar by default. Show only on hover or in an "Advanced" section.

### 4. Step 3 — FinalPreview
- **Download link is a plain text link**: `<button className="text-sm text-primary hover:underline">Download Final MP4</button>` — weak for the final action of the entire workflow.
- Fix: Replace with a proper styled button with Download icon.
- **Overlay toggles too small**: `scale-75` switches are hard to tap on mobile.
- Fix: Remove `scale-75`, use normal size with better spacing.

### 5. Page Header
- Current header is clean. No changes needed.

### 6. Global Progress Bar
- Looks good. Minor: add `rounded-2xl` to match card radius consistency.

## Implementation Plan

### File: `src/components/ad-director/AdDirectorContent.tsx`
- Line 46: Change `useState(DEMO_SCRIPT)` → `useState("")`
- Line 553: Add `rounded-2xl` to progress bar container
- Lines 684-690: Replace plain download link with styled Button

### File: `src/components/ad-director/ScriptInput.tsx`
- Add brand color preview strip below color pickers (small bar showing name on primary bg)
- Show Quick Start card conditionally (now actually visible since script starts empty)

### File: `src/components/ad-director/SceneCard.tsx`
- Wrap shot/camera/tone grid in a collapsible section (default collapsed)
- Move SceneIntelligenceBar inside the collapsible
- Keep prompt, quality badge, status, and thumbnail always visible

### File: `src/components/ad-director/FinalPreview.tsx`
- Remove `scale-75` from overlay toggle switches (lines 110, 114, 118)
- Improve spacing between toggles

## Files Modified
1. `src/components/ad-director/AdDirectorContent.tsx` — Fix script init, download button, progress radius
2. `src/components/ad-director/ScriptInput.tsx` — Brand color preview strip
3. `src/components/ad-director/SceneCard.tsx` — Collapse visual details, hide intelligence bar
4. `src/components/ad-director/FinalPreview.tsx` — Fix toggle scale, improve download UX

