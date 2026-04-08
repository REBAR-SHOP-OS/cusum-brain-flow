

# Improve Audio & File Attachment UI in Chat

## Problem
The current audio player and file attachment cards in both `MessageThread.tsx` and `DockChatBox.tsx` look plain — basic browser `<audio>` controls with minimal styling. The user wants a polished, modern UI for voice messages, music files, and generic file attachments.

## Changes

### 1. `src/components/teamhub/MessageThread.tsx` (audio section, lines 719-733)

Replace the plain audio row with a styled card:

```tsx
<div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-gradient-to-r from-muted/30 to-muted/10 max-w-[320px] backdrop-blur-sm">
  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
    <Mic className="w-4 h-4 text-primary" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-[10px] text-muted-foreground mb-1 truncate">
      {att.name || "Voice message"}
    </p>
    <audio controls preload="metadata" className="h-7 w-full min-w-0" src={att.url} />
  </div>
  <button onClick={...download...} className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 transition-colors" title="Download">
    <Download className="w-4 h-4 text-muted-foreground" />
  </button>
</div>
```

### 2. `src/components/teamhub/MessageThread.tsx` (generic file section, lines 735-745)

Replace the flat button with a styled file card:

```tsx
<div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-gradient-to-r from-muted/30 to-muted/10 max-w-[280px] cursor-pointer hover:bg-muted/40 transition-colors" onClick={...download...}>
  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
    <FileText className="w-4 h-4 text-primary" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-xs font-medium truncate">{att.name}</p>
    <p className="text-[10px] text-muted-foreground">{extension.toUpperCase()} file</p>
  </div>
  <Download className="w-4 h-4 text-muted-foreground shrink-0" />
</div>
```

### 3. `src/components/chat/DockChatBox.tsx` (audio section, lines 628-641)

Same styled card pattern as MessageThread but slightly smaller for the compact widget:

```tsx
<div key={...} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-gradient-to-r from-muted/30 to-muted/10 mt-1 max-w-full">
  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
    <Mic className="w-3 h-3 text-primary" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-[9px] text-muted-foreground mb-0.5 truncate">{att.name || "Voice message"}</p>
    <audio controls preload="metadata" className="h-6 w-full min-w-0" src={att.url} />
  </div>
  <button onClick={...download...} className="shrink-0 p-1 rounded-lg hover:bg-muted/60 transition-colors" title="Download">
    <Download className="w-3.5 h-3.5 text-muted-foreground" />
  </button>
</div>
```

### 4. `src/components/chat/DockChatBox.tsx` (generic file section, lines 653-658)

Wrap `InlineFileLink` in a slightly nicer container, or replace with the same styled file card pattern for consistency.

## Summary

| File | Section | Change |
|------|---------|--------|
| `MessageThread.tsx` | Audio (719-733) | Styled card with icon circle, filename label, download |
| `MessageThread.tsx` | Generic file (735-745) | Styled card with file icon, name, extension badge |
| `DockChatBox.tsx` | Audio (628-641) | Compact styled card matching MessageThread |
| `DockChatBox.tsx` | Generic file (653-658) | Compact styled file card |

Two files, four UI-only changes. No logic or data changes.

