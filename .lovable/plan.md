

## Fix RTL Text Overlapping Toolbar Icons in Chat Composer

### Problem
When typing Farsi (RTL) text in the chat input, the text flows underneath the bottom toolbar icons (emoji, voice, attach, etc.) because the textarea and toolbar share the same container without sufficient spacing.

### Changes

**File**: `src/components/teamhub/MessageThread.tsx`

1. Add `pb-10` (padding-bottom) to the Textarea so text content never flows behind the toolbar row
2. Make the bottom toolbar use `absolute` positioning at the bottom of the container so it overlays cleanly without interfering with text flow

Update the container and textarea (lines 852-881):
- Add `relative` to the container div (already there)
- Change Textarea className to include `pb-10` so text has clearance above the toolbar
- Optionally add `overflow-y-auto` to ensure long text scrolls properly

Update the bottom bar div (line 884):
- Keep it as a normal flow element but ensure the textarea's bottom padding creates enough space

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Add bottom padding to Textarea to prevent RTL text from going under toolbar icons |

