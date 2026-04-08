

# Fix: Agent Report Dialog Hidden Behind Vizzy Brain Panel

## Root Cause
The `AgentReportDialog` component (line 1206-1296 in `VizzyBrainPanel.tsx`) uses standard `<Dialog>` + `<DialogContent>` which renders at `z-50`. The Vizzy Brain panel renders at `z-[100000]`. Result: clicking the clipboard icon opens the dialog behind the panel — black overlay visible, content hidden.

This is the exact same bug that was previously fixed for `SectionDetailReportDialog` (which now uses `z-[100001]`/`z-[100002]`).

## Fix

**File: `src/components/vizzy/VizzyBrainPanel.tsx`** — Lines 1224-1294

Replace the standard `<DialogContent>` with `<DialogPortal>` + `<DialogOverlay>` + `<DialogPrimitive.Content>` using z-indices above `100000`:

```tsx
// Before (line 1224-1294):
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg">
    ...
  </DialogContent>
</Dialog>

// After:
<Dialog open={open} onOpenChange={setOpen}>
  <DialogPortal>
    <DialogOverlay className="z-[100001]" />
    <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[100002] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out ... sm:rounded-lg max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>...</DialogHeader>
      <ScrollArea className="flex-1 pr-2">
        ... (existing report content stays the same)
      </ScrollArea>
      <DialogPrimitive.Close className="absolute right-4 top-4 ...">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
</Dialog>
```

Also ensure that the necessary imports (`DialogPortal`, `DialogOverlay`, `DialogPrimitive`, `X`) are present at the top of the file.

## Result
- Agent report dialogs will render above the Brain panel (z-100002 > z-100000)
- No more black screen
- Reports will be fully visible and interactive

