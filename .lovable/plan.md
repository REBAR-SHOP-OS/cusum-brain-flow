

# Fix Print Preview Showing Broken Tag Layout

## Problem
When the user presses Ctrl+P on the `/office` Tags & Export page, the `beforeprint` event handler calls `e.preventDefault()` and opens `/print-tags` in a new window. However, **`preventDefault()` does not cancel the browser's native print dialog**. The browser still proceeds to print the current office page, which has sidebar, ScrollArea, and flex wrappers that break the tag layout (single-column stretch, clipping).

The `/print-tags` route works correctly — the issue is that the browser ignores `preventDefault()` on `beforeprint` and prints the office page anyway.

## Solution
Since `beforeprint` cannot be cancelled, use a **keyboard intercept** approach instead:

1. **Intercept Ctrl+P / Cmd+P keydown** — call `e.preventDefault()` on the `keydown` event (which CAN be cancelled), then open `/print-tags` in a new window.
2. **Remove the `beforeprint` listener** — it cannot prevent printing and only causes confusion.
3. **Keep the Print Tags button** working as-is (it already opens `/print-tags`).

## Changes

### `src/components/office/TagsExportView.tsx`
- Replace the `beforeprint` event listener with a `keydown` listener that intercepts `Ctrl+P` / `Cmd+P`
- Call `e.preventDefault()` and `e.stopPropagation()` on the keydown event to block the native print dialog
- Then call `handlePrint()` to open the dedicated `/print-tags` route

```tsx
// Replace beforeprint with keydown intercept
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      e.stopPropagation();
      handlePrint();
    }
  };
  window.addEventListener("keydown", handler, true); // capture phase
  return () => window.removeEventListener("keydown", handler, true);
}, [handlePrint]);
```

## Files changed
- `src/components/office/TagsExportView.tsx` — replace `beforeprint` listener with `keydown` Ctrl+P intercept

