

# Voice & Control Polish Fixes

## Overview

Address the two remaining gaps: voice auto-start from `?voice=1` URL param, and mic button visibility when browser lacks Web Speech API support. Also add ARIA labels, Escape-to-cancel for pending actions, and disable Send during pending confirmation.

## Changes

### 1. `src/components/chat/VoiceInputButton.tsx`

**Current:** Returns `null` when `isSupported` is false — mic button silently disappears.

**Fix:** Always render the button. When unsupported, show a disabled mic with a tooltip saying "Voice not supported in this browser".

- Remove the `if (!isSupported) return null` guard
- When `!isSupported`, render a disabled button with opacity and tooltip
- Add `aria-label` to the button for accessibility

### 2. `src/pages/LiveChat.tsx`

**A. Voice auto-start from `?voice=1`**

- `useSearchParams` is already imported
- Add a `useEffect` that checks for `voice=1` param
- If present and speech is supported, call `speech.start()` after a short delay (100ms to let the page mount)
- Clear the param with `setSearchParams({}, { replace: true })` to prevent re-triggers

**B. Escape key cancels pending action**

- In the existing `handleKeyDown`, add: if `Escape` is pressed and `pendingAction` exists, call `cancelAction()`

**C. Disable Send while pending action**

- Update the Send button's `disabled` prop to also check `!!pendingAction`

**D. ARIA labels on Send/Stop buttons**

- Add `aria-label="Send message"` to Send button
- Add `aria-label="Stop generating"` to Stop button

## No backend changes needed

All fixes are frontend-only — two files, minimal edits.
