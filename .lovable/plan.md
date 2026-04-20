

## Goal
Stop the *"The app encountered an error / Show logs / Try to fix"* overlay that appears every time the **AI Prompt** preview dialog opens on `/ad-director`. The 402 *AI credits exhausted* toast itself is already correct — it should keep firing as the only user-visible feedback when the workspace balance is empty.

## Root cause (confirmed from console logs)
The overlay is **not** caused by the 402 response. It is caused by a separate React dev warning that the Lovable preview escalates:

```
Warning: Function components cannot be given refs.
Check the render method of `AIPromptDialog`.
    at DialogFooter (src/components/ui/dialog.tsx:101:25)
    ...
    at AIPromptDialog
```

In `src/components/ui/dialog.tsx`, `DialogHeader` and `DialogFooter` are plain function components:

```ts
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={...} {...props} />
);
```

Radix's `DialogContent` runs an autofocus pass when it opens and tries to attach a ref through descendant components for focus restoration. Because `DialogHeader` / `DialogFooter` are not `forwardRef`, React logs the warning. Lovable's `GlobalErrorWatcher` / preview error layer treats it as a fatal app error and shows the *"Show logs / Try to fix"* card.

The 402 toast appears at the same time only because the AI request also rejects when the dialog opens — it is a coincidence, not the cause. The overlay would also appear on a workspace with full credits.

## Changes

### 1) `src/components/ui/dialog.tsx` — primary fix (1 file, 2 components)
Convert `DialogHeader` and `DialogFooter` from plain function components into `React.forwardRef` components, matching the pattern already used by `DialogOverlay`, `DialogContent`, `DialogTitle`, and `DialogDescription` in the same file. Behavior, classes, and props remain identical — only the ref forwarding changes. This silences the warning and removes the trigger for the preview error overlay.

This is a shadcn-standard fix and matches the canonical shadcn `dialog.tsx` template.

### 2) No other code changes
- `ChatPromptBar.handleAiWrite` already catches the 402, classifies it via `classifyEdgeFunctionError`, shows the destructive toast, and closes the preview cleanly. No change needed.
- `invokeEdgeFunction` already preserves `status = 402`. No change needed.
- `AdDirectorErrorBoundary`, `useGlobalErrorHandler`, and `backgroundAdDirectorService` are correct. No change needed.
- The 402 toast continues to be the single, accurate message shown to the user when AI credits are exhausted.

## Files touched
- `src/components/ui/dialog.tsx`

## Validation (after switch to default mode)
1. Click **AI Prompt** on `/ad-director` → the *"The app encountered an error / Show logs / Try to fix"* overlay no longer appears.
2. With exhausted credits → only the red *"AI credits exhausted"* toast is shown; the preview dialog closes cleanly; the page stays interactive.
3. With sufficient credits → the AI prompt is generated, written into the dialog textarea, and "Use this prompt" works.
4. No new React console warnings about refs on `DialogFooter` / `DialogHeader`.
5. Other dialogs across the app (which also use `DialogFooter` / `DialogHeader`) continue to render and behave identically — only the warning disappears.

## Out of scope (left untouched)
- AI credit balance itself (only the user can top up at Settings → Workspace → Cloud & AI balance)
- Edge function logic, RLS, scene generation, music, transitions, and editor pipeline
- All other Ad Director surfaces and components

