
# Fix Meeting Banner UI in Team Hub

## Problem
The active meetings banner at the top of the message thread shows multiple meeting entries (one per active meeting), resulting in duplicate "Join" buttons and cluttered display. The user wants:
1. Only **one** "Join" button visible
2. The individual meeting detail rows (title, LIVE badge) should not be shown

## Fix

### `src/components/teamhub/MessageThread.tsx` (lines 500-525)

Replace the current multi-meeting banner with a single, compact Join button that joins the most recent active meeting:

**Before:** Loops over all `activeMeetings`, showing title + LIVE badge + Join button for each.

**After:** Show only a single compact banner with one "Join" button for the latest meeting. No meeting title, no LIVE badge — just a simple indicator and button:

```tsx
{activeMeetings.length > 0 && (
  <div className="border-b border-border bg-primary/5 px-5 py-2 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-xs font-medium text-muted-foreground">
        Active meeting in progress
      </span>
    </div>
    <Button
      size="sm"
      variant="default"
      className="h-7 text-xs gap-1.5 rounded-full"
      onClick={() => onJoinMeeting?.(activeMeetings[0])}
    >
      <Video className="w-3 h-3" />
      Join
    </Button>
  </div>
)}
```

Single file, single change. Removes the `.map()` loop, shows one Join button for the first (most recent) meeting, and removes the title/LIVE badge display.
