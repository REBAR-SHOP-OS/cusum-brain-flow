

# Remove Popover Menu on Video Card Click

## Problem
When clicking a video card on the timeline, a popover menu (Select, Edit Prompt, Trim Scene, etc.) appears. The user wants clicking to only select the scene and seek — not show this menu.

## Solution
Change the `Popover` wrapping each video card from click-triggered to **right-click only** (context menu). This preserves all menu functionality but removes the unwanted popup on normal clicks.

## Changes — `src/components/ad-director/editor/TimelineBar.tsx`

### Lines 700-851: Convert Popover to right-click context menu
- Remove the `<Popover>` and `<PopoverTrigger asChild>` wrapper from the video card `<div>`
- Instead, add `onContextMenu` handler on the card div that opens a controlled popover/dropdown
- Use `Popover` with `open` state controlled by right-click only
- Normal left-click continues to select + seek (existing `onClick` handler stays)

**Before:** `<Popover>` → `<PopoverTrigger asChild>` → card div → `</PopoverTrigger>` → `<PopoverContent>` menu → `</Popover>`

**After:** Card div with `onContextMenu` → controlled `<Popover open={contextMenuScene === i}>` with the same menu content

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx`

## Result
- Left-click: selects scene + seeks (no menu)
- Right-click: shows the action menu (Select, Edit Prompt, Trim, etc.)

