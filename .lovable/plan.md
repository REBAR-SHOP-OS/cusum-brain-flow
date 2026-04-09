

# Fix: Make "Add to Timeline" Button Visible and Consistent

## Problem
The "Add to Timeline" button uses `variant="ghost"` which is nearly invisible against the dark top bar. Other buttons (Save Draft, Send Email, Print/PDF) use solid/secondary/outline variants and are clearly visible.

## Fix

### File: `src/components/accounting/documents/DraftQuotationEditor.tsx` (line 435)

Change the button variant from `ghost` to `outline` to match the style of "Print / PDF" and the close button:

```tsx
// From:
<Button size="sm" variant="ghost" onClick={...} className="gap-2" title="Add to Timeline">
  <CalendarPlus className="w-4 h-4" /> Add to Timeline
</Button>

// To:
<Button size="sm" variant="outline" onClick={...} className="gap-2" title="Add to Timeline">
  <CalendarPlus className="w-4 h-4" /> Add to Timeline
</Button>
```

Single prop change in one file. No logic or database changes.

