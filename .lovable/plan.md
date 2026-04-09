

# Fix Links Not Opening Correctly in Team Hub Chat

## Problems Found

1. **Links open inside the iframe instead of a new browser tab** — `target="_blank"` on `<a>` tags inside the Lovable preview iframe can be blocked by the iframe sandbox. YouTube and similar sites refuse to load inside the frame, showing "ERR_BLOCKED_BY_RESPONSE". The fix is to use `window.open()` via an `onClick` handler instead of relying on the default `<a>` behavior.

2. **Regex bug in MessageThread.tsx** — The `urlRegex` uses the `g` flag, but `test()` is called *before* resetting `lastIndex` (line 308-309). This causes alternating URLs to not be detected as links. The `lastIndex` reset needs to move before the `test()` call.

## Changes

### File: `src/components/teamhub/MessageThread.tsx` (lines 298-320)

1. **Fix regex lastIndex bug**: Move `urlRegex.lastIndex = 0` to *before* `urlRegex.test(segment)` (like DockChatBox already does correctly)
2. **Force new tab with window.open()**: Change the `<a>` onClick handler to call `e.preventDefault(); window.open(segment, '_blank', 'noopener')` so links always open in a real browser tab, bypassing iframe restrictions

### File: `src/components/chat/DockChatBox.tsx` (lines 441-456)

1. **Force new tab with window.open()**: Same onClick fix — `e.preventDefault(); e.stopPropagation(); window.open(part, '_blank', 'noopener')` to ensure links open outside the iframe

## Result
All URLs shared in Team Hub and the dock chat widget will open in a new browser tab reliably, even when the app runs inside the Lovable preview iframe.

