

# Always Show Smart Buttons Bar in Sales Lead Drawer

## Problem
The `LeadSmartButtons` component hides itself entirely when there are no related quotations, orders, or invoices (`if (!hasAny) return null`). The user wants it always visible, showing zero counts like Odoo does (e.g., "No Meeting", "Quotations 0", "Orders 0").

## Fix
**File: `src/components/sales/LeadSmartButtons.tsx`**

1. Remove the `if (!hasAny) return null` guard (line 75) so the bar always renders
2. Show all three items regardless of count (remove the `.filter(i => i.count > 0)` on line 82)
3. Display "0" counts with muted styling to indicate no related records yet

This matches Odoo's behavior where smart buttons are always visible with their counts.

## Files Changed
- `src/components/sales/LeadSmartButtons.tsx` — remove conditional hiding, show all items always

