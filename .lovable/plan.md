

# Scrollable Text + Larger Font for Interpreter

## Changes

### `src/pages/AzinInterpreter.tsx`

1. **Ensure ScrollArea works properly**: The `ScrollArea` already wraps content, but `flex-1` may not give it a concrete height. Add `min-h-0` to the parent flex container so the ScrollArea can shrink and scroll.

2. **Increase font size**: Change all transcript text from `text-sm` to `text-base` (16px) for better readability. Change partial text similarly. Also increase line spacing with `space-y-4` instead of `space-y-3`.

3. **Farsi column**: Add `font-family: Vazirmatn` inline style for Farsi text items, and increase font size to `text-base` as well.

### Specific line changes:
- Line 102: Add `min-h-0` to the grid container so flex children can scroll
- Lines 120, 130, 154, 163: Change `text-sm` → `text-base` for all transcript text
- Lines 109, 143: Change `space-y-3` → `space-y-4`
- Farsi text items: ensure `style={{ fontFamily: '"Vazirmatn", "Tahoma", sans-serif' }}`

