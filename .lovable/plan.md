
# Add Ctrl+V Paste Support to DockChatBox

## Current State

The `DockChatBox.tsx` component already has:
- Drag-and-drop: `onDragOver`, `onDragLeave`, `onDrop` handlers on the outer container (lines 285-287)
- Drop visual overlay: shown when `dragOver` state is true (lines 479-484)
- `addFiles` helper function: shared logic for validating and queueing files (lines 139-150)
- File input button (paperclip) working correctly

**What's missing: Ctrl+V / paste support on the input field.**

The input `<input>` element at line 457 only has `onChange` and `onKeyDown` — there is no `onPaste` handler, so pasting an image from clipboard does nothing.

## The Fix — One Addition Only

Add an `onPaste` handler to the `<input>` element at line 457-464:

```tsx
onPaste={(e) => {
  const files = e.clipboardData?.files;
  if (files?.length) {
    e.preventDefault();
    addFiles(files);
  }
}}
```

When a user presses Ctrl+V:
- If the clipboard contains files/images → `e.preventDefault()` stops default paste behavior, `addFiles()` queues them as pending files
- If the clipboard contains only text → the handler does nothing, normal text paste proceeds naturally

## Scope

| File | Change |
|---|---|
| `src/components/chat/DockChatBox.tsx` | Add `onPaste` to the composer `<input>` element (line ~462) |

No other changes needed. The existing `addFiles` function, pending file display, and upload logic already handle everything correctly.
