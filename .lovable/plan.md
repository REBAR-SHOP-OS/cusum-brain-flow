

## Fix Message Text Being Cut Off in Team Hub

### Problem
Long messages in Team Hub chat get cut off and are not fully readable. The text container lacks proper word-breaking CSS, causing text to overflow its container instead of wrapping.

### Changes

**File**: `src/components/teamhub/MessageThread.tsx`

1. **Line 664** — Add `break-words` class to the message `<p>` tag:
   - Current: `"text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed"`
   - New: `"text-sm font-medium text-foreground whitespace-pre-wrap break-words leading-relaxed"`

2. **Line 596** — Add `overflow-hidden` to the message content wrapper `<div className="flex-1 min-w-0">`:
   - Current: `"flex-1 min-w-0"`
   - New: `"flex-1 min-w-0 overflow-hidden"`

This ensures long words, URLs, and code blocks wrap properly within the message bubble instead of overflowing and being hidden.

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Add `break-words` to message text, `overflow-hidden` to content wrapper |

