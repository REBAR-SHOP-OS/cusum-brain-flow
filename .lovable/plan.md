

# Fix: Icons overflowing chat box

The 14 style + product icons plus the attachment/model buttons are all in one row, causing overflow.

## Solution
Wrap the style and product icon rows so they scroll horizontally or wrap to a second line within the toolbar. The simplest fix: make the icon container `flex-wrap` with `overflow-x-auto` and reduce icon sizes slightly.

### Changes in `src/components/chat/ChatInput.tsx`

1. **Style icons container** (line 519): Change from rigid `flex` to `flex flex-wrap` with `overflow-x-auto` and reduce padding/gap
2. **Product icons container** (line 559): Same treatment
3. **Reduce icon sizes**: Style icons `w-5 h-5` → `w-4 h-4`, Product icons `w-6 h-6` → `w-5 h-5`, button padding `p-2` → `p-1.5`
4. **Wrap the entire toolbar row** (the parent `div` containing all these icons) with `flex-wrap` so style and product icons can flow to a second line if needed

This keeps all icons visible and interactive without breaking out of the chat box boundaries.

