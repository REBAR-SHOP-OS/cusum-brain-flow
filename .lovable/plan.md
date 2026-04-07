

# Fix: Black Buttons & Invisible Text in Quotation Editor (Dark Mode)

## Root Cause

The app runs in dark mode. The quotation document container at line 449 has `bg-white text-gray-900`, but all Button components inside it use CSS variable-based classes like `bg-background` (the outline variant) and `bg-primary` (the default variant). In dark mode:

- `bg-background` → `hsl(222 47% 6%)` → nearly black
- `border-input` → dark border
- `text-primary-foreground` → may blend into the dark button

So "Add Line", "Upload", Ship Date picker, and the top action buttons all render with dark backgrounds and invisible text.

## Fix

**Force light theme on the document area** by adding a `data-theme="light"` or simply wrapping with a class that resets CSS variables to light values. The cleanest approach: add the `.light` class (or remove `.dark` context) on the document wrapper so all shadcn components inside render in light mode.

### File: `src/components/accounting/documents/DraftQuotationEditor.tsx`

**Change 1** — Wrap the entire editor return in a div that forces light theme:

At the outermost wrapper (around line 395-398 where the return starts), add a wrapping `<div className="light">` so all CSS variables resolve to light mode values inside the document.

The return currently starts roughly with the email dialog + action buttons + document. Wrap everything inside a `<div className="light bg-transparent">` container.

**Change 2** — The action buttons (Save Draft, Send Email, Print/PDF) at line 434 also need to be inside this light wrapper since they appear over the document.

### File: `src/components/accounting/DocumentAttachments.tsx`

No changes needed — once the parent forces light theme, the Upload button's `bg-background` will resolve to white automatically.

### File: `src/components/accounting/documents/DraftInvoiceEditor.tsx`

Apply the same light-theme wrapper for consistency (same issue likely exists there).

## Expected Result

- "Add Line" button: white background, visible dark text
- "Upload" button: white background, visible dark text  
- Ship Date picker: white background, visible text
- "Save Draft": teal/primary background with visible white text
- All inputs, selects, and popovers inside the document render in light mode

## Scope
| File | Change |
|------|--------|
| `src/components/accounting/documents/DraftQuotationEditor.tsx` | Add `light` class wrapper around editor |
| `src/components/accounting/documents/DraftInvoiceEditor.tsx` | Same light class wrapper |

