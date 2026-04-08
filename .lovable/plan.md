

# Fix Non-Working Report Icons in Team Daily Report

## Root Cause

The `SectionDetailReportDialog` component (the clipboard icon button) is placed **inside** the `<AccordionTrigger>` on line 1059-1066. Radix UI's `AccordionTrigger` renders as a `<button>`, so the dialog trigger button becomes a **nested button inside a button** — this is invalid HTML and causes the click to be captured by the accordion toggle instead of opening the dialog. The `e.stopPropagation()` in the dialog button is insufficient because Radix internally handles the event at a higher level.

The team-level icon (line 1007) is outside the accordion and should work. The per-user icons inside `AccordionTrigger` are broken.

## Fix

Move the `SectionDetailReportDialog` **outside** the `AccordionTrigger`, placing it in the `AccordionItem` layout so the icon sits visually in the same row but is not a child of the trigger button.

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

**Change the AccordionItem structure** (lines ~1029-1067):

- Wrap the `AccordionTrigger` and `SectionDetailReportDialog` in a `div` with `flex` layout
- The `AccordionTrigger` takes `flex-1` to fill the row
- The `SectionDetailReportDialog` sits beside it as a sibling, not a child
- This preserves the visual layout (icon on the right of each user row) while making the button independently clickable

```
Before:
  <AccordionItem>
    <AccordionTrigger>
      <span>...user info...</span>
      <SectionDetailReportDialog />   ← INSIDE trigger (broken)
    </AccordionTrigger>
    <AccordionContent>...</AccordionContent>
  </AccordionItem>

After:
  <AccordionItem>
    <div className="flex items-center">
      <AccordionTrigger className="flex-1">
        <span>...user info...</span>
      </AccordionTrigger>
      <SectionDetailReportDialog />   ← OUTSIDE trigger (works)
    </div>
    <AccordionContent>...</AccordionContent>
  </AccordionItem>
```

| File | Change |
|------|--------|
| `VizzyBrainPanel.tsx` | Move per-user `SectionDetailReportDialog` from inside `AccordionTrigger` to a sibling element |

