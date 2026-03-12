

# Upgrade Transitions Tab — Canva/Clipchamp Style

## What
Redesign the TransitionsTab to match the professional video editor look from the reference images. Add more transition types organized by category (Fades & Blurs, Wipes), thumbnail previews with gradient visuals, a duration slider, and a search bar.

## Changes

### `src/components/ad-director/editor/TransitionsTab.tsx` — Full Rewrite

**New transition categories:**
- **Fades & Blurs**: Cross fade, Cross blur, Fade through black, Fade through white, Burn, Tiles
- **Wipes**: Hard wipe down, Hard wipe up, Hard wipe left, Hard wipe right
- **Motion**: Slide up, Slide down, Zoom in, Zoom out, Horizontal banding

**New UI elements:**
- Search input at top to filter transitions
- Grid layout (2 columns) with visual thumbnail cards showing gradient previews
- Each card: gradient preview square + label below
- Selected state: primary border + glow
- Duration slider (0.1–2.0s) below the grid when a transition is selected
- Category headers (uppercase label like "FADES & BLURS", "WIPES")

**Props update:**
- Add `duration: number` and `onDurationChange: (d: number) => void` props
- Keep existing `activeTransition` / `onSelect`

### `src/components/ad-director/ProVideoEditor.tsx`
- Pass `duration` and `onDurationChange` to TransitionsTab
- Add `transitionDuration` to editor settings state (default 0.5)

### Visual Style
- Dark card backgrounds matching the editor theme
- Gradient thumbnails to represent each transition type visually
- Compact grid with rounded corners

## Files Changed
- `src/components/ad-director/editor/TransitionsTab.tsx` — full rewrite
- `src/components/ad-director/ProVideoEditor.tsx` — pass duration props

