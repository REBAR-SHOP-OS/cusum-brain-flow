

## Analysis

The code in `CompanyDefaultItems.tsx` already applies green/red styling (`bg-green-500/10`, `bg-red-500/10`) but the colors are very subtle (only 10% opacity). The user wants a clearly visible green or red state on the entire row.

## Plan

### File: `src/components/purchasing/CompanyDefaultItems.tsx`

Make the row colors more prominent when purchased (green) or rejected (red):

1. **Row background** (line 90-94): Increase opacity from `bg-green-500/10` → `bg-green-500/20` and `bg-red-500/10` → `bg-red-500/20`
2. **Row border**: Strengthen from `/30` → `/50` for both green and red
3. **Text color** (line 142-145): Already has `text-green-600` and `text-red-500` with line-through — keep as is
4. **Button icons**: Already styled — keep as is

Same treatment for **custom items** in `PurchasingListPanel.tsx` (lines ~165-170) for consistency.

Minimal 2-file change, purely visual.

