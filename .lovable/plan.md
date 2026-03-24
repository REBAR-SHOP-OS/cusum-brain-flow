

## Add Language Selector to Composer Badge

### Problem
The language badge in the composer toolbar (showing "فارسی 🇮🇷") is static — it just displays the user's profile language. The user wants it to be a clickable selector to switch between languages for sending messages.

### Changes

**File**: `src/pages/TeamHub.tsx`
1. Add local state `activeLang` initialized from `myProfile?.preferred_language || "en"`
2. Pass `activeLang` instead of `myLang` to `MessageThread` and use it as `senderLang` in send/forward mutations
3. Pass a new `onLangChange` callback to `MessageThread`

**File**: `src/components/teamhub/MessageThread.tsx`
1. Accept new prop `onLangChange?: (lang: string) => void`
2. Replace the static `Badge` (line 975-977) with a `Popover` language selector:
   - Shows current language flag + name as a clickable button
   - Opens a popover listing all `LANG_LABELS` languages
   - Clicking a language calls `onLangChange` and closes the popover
3. Style it similar to the voice input language selector but as a standalone badge-style button

### Files Changed

| File | Change |
|---|---|
| `src/pages/TeamHub.tsx` | Add `activeLang` state, pass to MessageThread + use in mutations |
| `src/components/teamhub/MessageThread.tsx` | Replace static Badge with Popover language selector |

