

## Fix Download Button on Delivery Terminal

The Download button at line 155-157 of `src/pages/DeliveryTerminal.tsx` has no `onClick` handler.

### Change to `src/pages/DeliveryTerminal.tsx`

Add `onClick={() => window.print()}` to the Download button so it triggers the browser's print dialog, which allows saving as PDF or printing the delivery checklist.

```tsx
<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.print()}>
  <Download className="w-4 h-4" />
</Button>
```

This is the simplest and most effective approach — `window.print()` lets the driver save a PDF or print the packing slip directly from the browser.

