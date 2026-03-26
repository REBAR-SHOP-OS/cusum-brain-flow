

# Make Scene Cards Much Larger

## Change
Increase scene card size from `w-[200px]` to `w-[280px]` and use a grid layout instead of a narrow horizontal scroll, so each scene is clearly visible.

### In `src/components/ad-director/AdDirectorContent.tsx`

**Line 335**: Change title from `text-xs` to `text-sm`

**Line 336**: Change from `flex overflow-x-auto gap-3` to `grid grid-cols-2 gap-4` — a 2-column grid so cards are large and fully visible without scrolling

**Line 346**: Change card width from `w-[200px]` to full width (remove `w-[200px] flex-shrink-0`), increase border radius and add min-height

**Label overlay (line 383)**: Increase font from `text-[10px]` to `text-xs` for readability

This makes each card roughly 50% of the container width (~350-400px each) with proper aspect-video thumbnails — much easier to see than the current small 200px strips.

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Enlarge scene cards: 2-col grid, bigger labels |

