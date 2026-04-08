

# Show Empty State When Team Hub Opens (No Auto-Select)

## Problem
When clicking the Team Hub icon, the page auto-selects the first channel (`channels[0]?.id`), showing a conversation immediately. The user wants to see a blank/empty state instead — no channel pre-selected.

## Change

### `src/pages/TeamHub.tsx`

**Line 76** — Remove the fallback to `channels[0]?.id`:

```tsx
// Before
const resolvedChannelId = isNotesView
  ? selfChannelId
  : selectedChannelId || (channelsLoading ? null : channels[0]?.id || null);

// After
const resolvedChannelId = isNotesView
  ? selfChannelId
  : selectedChannelId;
```

**In the JSX** — When `activeChannelId` is null and it's not loading, show an empty welcome state instead of `MessageThread`:

```tsx
{!activeChannelId && !channelsLoading ? (
  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
    <MessageSquare className="w-12 h-12 opacity-30" />
    <p className="text-sm">Select a channel or conversation to start</p>
  </div>
) : (
  <MessageThread ... />
)}
```

One file, two small edits. No channel auto-selected on load.

