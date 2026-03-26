

# Add Full Team Hub Chat Features to Dock Chat Box

## Problem
The DockChatBox (popup chat) only has basic text + file sending. It's missing all the advanced features from the Team Hub's MessageThread: reply, forward, @mentions, voice messages, voice input (speech-to-text), emoji picker, TTS playback, message deletion, translation toggle (show original), and the spellcheck button.

## Approach
Rather than duplicating all ~1000 lines of MessageThread logic into DockChatBox, we will refactor DockChatBox to embed a compact version of MessageThread's features. Given the small UI size (320px wide), we'll adapt the features to fit.

## Changes

### `src/components/chat/DockChatBox.tsx`

**1. Message actions (hover toolbar per message):**
- Add hover-reveal action buttons on each message bubble: Reply, Forward, Delete (admin only), Copy, TTS (play/stop)
- Reply: sets `replyTo` state, shows reply preview bar above composer
- Forward: calls a forward handler that opens a channel picker dialog
- Delete: admin-only (radin, sattar, neel), deletes from DB

**2. Reply support:**
- Add `replyTo` state (TeamMessage | null)
- Show reply preview bar above input (sender name + truncated text + X to cancel)
- Pass `replyToId` to `sendMutation.mutateAsync()`
- Show quoted reply above message bubbles when `msg.reply_to_id` is set

**3. @Mentions:**
- Import `MentionMenu` component
- Track `mentionOpen`, `mentionFilter`, `mentionStart` state
- On typing `@`, show mention dropdown filtered by profiles
- On select, insert `@FullName ` into input
- Highlight @mentions in message text display

**4. Voice messaging (record & send audio):**
- Import `useVoiceRecorder` hook
- Add mic button in composer (hold/toggle to record)
- On send, upload audio blob to storage, send as attachment

**5. Voice input (speech-to-text):**
- Import `VoiceInputButton` and `useSpeechRecognition`
- Add voice-to-text button in composer
- Append transcribed text to input field

**6. Emoji picker:**
- Import `EmojiPicker` component
- Add emoji button in composer toolbar

**7. Translation toggle:**
- On message bubble, if translations exist and sender is not me, show a small globe/toggle to switch between translated and original text

**8. Upgrade composer from `<input>` to `<textarea>`:**
- Replace single-line input with a small auto-sizing textarea to support multi-line + mention detection

**9. Forward dialog:**
- Add a small `ForwardDialog` component (or inline popover) that lists available channels/DMs
- On select, send the forwarded message to that channel

### `src/hooks/useTeamChat.ts`
- No changes needed — `useSendMessage` already supports `replyToId`

### Files affected

| File | Change |
|---|---|
| `src/components/chat/DockChatBox.tsx` | Add reply, forward, @mentions, voice record, voice input, emoji, TTS, delete, translation toggle, upgrade composer to textarea |

## Compact UI adaptations
Since DockChatBox is 320px wide:
- Message action buttons: small icons (w-3 h-3), shown on hover
- Reply preview: single line with truncation
- Mention menu: positioned above textarea, max 4 items visible
- Emoji picker: small popover
- Voice controls: inline in composer bar
- Forward: small popover with channel list

