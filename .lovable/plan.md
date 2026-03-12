

# AI Video Director — Live Audit & Polish

## Issues Found

From the screenshot and code review, the page currently on `/home` shows the Ad Director tile in AutomationsSection. The screenshot shows the header with a stray toggle switch beneath it. Looking at the page itself:

### 1. Header has no stray toggle — screenshot is from AutomationsSection tile
The uploaded screenshot shows the automation tile card, not the actual page. The tile looks decent but the toggle is confusing (likely an enable/disable for the automation).

### 2. Step 1 (Script & Assets) — Polish Issues
- **Quick Start card disappears permanently** after loading demo. User can't clear script and see it again easily. No "Clear script" action.
- **Script textarea `font-mono`** feels like code, not creative copy. Should be `font-sans` for a marketing tool.
- **Brand Kit card has no visual separation** between the identity fields and the color section — it reads as a wall of inputs.
- **Color pickers** use native `<input type="color">` which looks rough on some browsers. Acceptable but not premium.
- **Brand preview strip** has no rounded corners matching the card (`rounded-lg` but card is `rounded-2xl`).

### 3. Step Indicator
- **Completed step uses `bg-accent/20`** which may be invisible on dark themes depending on accent color. Should use `bg-emerald-500/20` for clear visual feedback.
- **Connecting lines (`w-8 h-px`)** are too short and thin — barely visible.

### 4. Storyboard (Step 2)
- **"Scene details ▸" trigger** uses a text arrow `▸` instead of a proper chevron icon — inconsistent with the rest of the UI.
- **SceneCard body** shows the prompt in `line-clamp-3` but no "show more" — truncated prompts can't be read without clicking edit.

### 5. Final Preview (Step 3)
- **Export button gradient** (`from-emerald-600 to-emerald-500`) is barely distinguishable — needs more contrast.
- **No "Back to Storyboard" navigation** from preview step.

### 6. General
- **No empty state illustration** for Step 2/3 when accessed directly (disabled steps handle this, but still).
- **`rounded-xl` on FinalPreview and ContinuityInspector** while ScriptInput cards use `rounded-2xl` — inconsistent.

## Implementation Plan

### File: `src/components/ad-director/ScriptInput.tsx`
- Change `font-mono` to `font-sans` on textarea
- Add "Clear" button next to "Load Demo" when script exists
- Change brand preview strip to `rounded-xl` for consistency
- Add a subtle divider between brand fields and color pickers

### File: `src/components/ad-director/AdDirectorContent.tsx`
- Fix completed step circle: `bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30`
- Widen connecting lines: `w-12 h-[2px]` with proper color
- Add "Back to Storyboard" button on preview step

### File: `src/components/ad-director/SceneCard.tsx`
- Replace `▸` text with `ChevronRight` icon in collapsible trigger
- Add "show more/less" toggle for long prompts instead of hard `line-clamp-3`

### File: `src/components/ad-director/FinalPreview.tsx`
- Upgrade card from `rounded-xl` to `rounded-2xl` for consistency
- Increase export button gradient contrast: `from-emerald-600 to-teal-500`

### File: `src/components/ad-director/ContinuityInspector.tsx`
- Upgrade card from `rounded-xl` to `rounded-2xl`

### File: `src/components/ad-director/StoryboardTimeline.tsx`
- No structural changes, cards look good

## Files Modified
1. `src/components/ad-director/ScriptInput.tsx` — Font, clear button, preview strip, divider
2. `src/components/ad-director/AdDirectorContent.tsx` — Step indicator colors, line width, back navigation
3. `src/components/ad-director/SceneCard.tsx` — Chevron icon, prompt expand toggle
4. `src/components/ad-director/FinalPreview.tsx` — Border radius, export gradient
5. `src/components/ad-director/ContinuityInspector.tsx` — Border radius

