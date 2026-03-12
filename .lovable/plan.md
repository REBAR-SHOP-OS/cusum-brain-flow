

## Video Studio UI Redesign — Kling-Style Bottom Bar

The reference images show a fundamentally different layout from the current form-based design. The target aesthetic is a **floating bottom bar** with inline controls, similar to Kling AI's interface.

### Key Design Elements from References

1. **Left sidebar icons**: Toggle between Image / Video / Audio modes (vertical icon strip)
2. **Large prompt textarea**: Clean, minimal, dark background with glass effect
3. **Bottom pill chips**: Model selector, aspect ratio, duration, audio toggle — all as compact rounded pills in a single row
4. **Generate button**: Large, gradient/glass pill on the right side
5. **Floating card design**: Rounded corners, glassmorphism, overlaid on a dark/blurred background

### Implementation Plan

**1. Create `VideoStudioPromptBar.tsx`** — New floating bottom-bar component
- Dark glass card with rounded-2xl corners
- Left vertical icon strip: Image mode / Video mode / Audio mode (only video active for now)
- Large textarea with no visible border, placeholder: "Describe the video you want to create"
- Bottom row of pill-shaped chips:
  - Mode chip (Fast / Balanced / Premium) — clickable dropdown
  - Aspect ratio chip (16:9 / 9:16 / 1:1)
  - Duration chip (5 sec / 8 sec / 12 sec)
  - Negative prompt chip (optional toggle)
  - Credits remaining indicator
- Right-aligned gradient Generate button pill
- Engineered prompt toggle as a small eye icon

**2. Update `VideoStudioContent.tsx`**
- Replace the current form-based left column with the new `VideoStudioPromptBar`
- Keep all generation logic, polling, audio, editor, and social panel intact
- In full-page mode: prompt bar at bottom, results area fills the main viewport above
- In dialog mode: prompt bar at top, results below

**3. Update `VideoStudio.tsx` page**
- Full-bleed dark layout with cinematic preview cards in the background area
- Prompt bar pinned to bottom of viewport
- Results appear as overlay cards above the bar

### Component Structure

```text
┌──────────────────────────────────────────────────┐
│                                                  │
│          Results / Preview Area                   │
│          (video player, library grid)             │
│                                                  │
├──────────────────────────────────────────────────┤
│ ┌──┐                                       ┌──┐ │
│ │🖼│  Describe the video you want to create │↗ │ │
│ │▶ │                                        │  │ │
│ │🎵│                                        │  │ │
│ └──┘                                        └──┘ │
│ [⚡Fast] [⬜ 16:9] [⏱ 8 sec] [💎 2K]  [Generate]│
└──────────────────────────────────────────────────┘
```

### Styling Details
- Background: `bg-black/80 backdrop-blur-xl border border-white/10`
- Pills: `bg-white/10 hover:bg-white/15 text-white/80 rounded-full px-3 py-1.5`
- Generate button: `bg-gradient-to-r from-sky-200 to-white text-black font-semibold rounded-full`
- Left icons: `bg-white/10 rounded-lg p-2` with active state highlight
- Textarea: transparent background, white text, no ring on focus

### Files Changed
- **Create**: `src/components/social/VideoStudioPromptBar.tsx`
- **Modify**: `src/components/social/VideoStudioContent.tsx` (swap input section for new bar)
- **Modify**: `src/pages/VideoStudio.tsx` (dark full-bleed layout)

### What Stays the Same
- All generation logic, polling, credit system, audio, editor, social panel
- Edge functions unchanged
- Hook logic unchanged

