

# Add Download Button to Voice Messages in DockChatBox

## Problem
The `DockChatBox` component renders audio attachments with only a mic icon and `<audio controls>` player — no download button. The Team Hub's `MessageThread.tsx` already has this feature (line 732-738), but the floating chat widget (`DockChatBox`) does not.

## Fix

### `src/components/chat/DockChatBox.tsx`

Add a download button next to the audio player, matching the pattern already used in `MessageThread.tsx`:

**Before (lines 628-634):**
```tsx
{uniqueAttachments.filter((a) => isAudioUrl(a.url)).map((att, ai) => (
  <div key={`aud-${ai}`} className="flex items-center gap-1.5 p-1.5 rounded-lg border border-border bg-muted/20 mt-1 max-w-full">
    <Mic className="w-3 h-3 text-primary shrink-0" />
    <audio controls preload="metadata" className="h-7 w-full min-w-0" src={att.url} />
  </div>
))}
```

**After:**
```tsx
{uniqueAttachments.filter((a) => isAudioUrl(a.url)).map((att, ai) => (
  <div key={`aud-${ai}`} className="flex items-center gap-1.5 p-1.5 rounded-lg border border-border bg-muted/20 mt-1 max-w-full">
    <Mic className="w-3 h-3 text-primary shrink-0" />
    <audio controls preload="metadata" className="h-7 w-full min-w-0" src={att.url} />
    <button
      onClick={() => downloadFile(att.url, att.name || "voice-message.webm")}
      className="shrink-0 p-1 rounded hover:bg-muted/60 transition-colors"
      title="Download"
    >
      <Download className="w-3.5 h-3.5 text-muted-foreground" />
    </button>
  </div>
))}
```

- Import `downloadFile` from `@/lib/downloadUtils` (the `Download` icon is already imported on line 5)
- Single file, single change — consistent with `MessageThread.tsx` pattern

