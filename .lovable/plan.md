

## Add @Mention and Reply-to-Message in Team Hub Chat

### What
1. **@Mention**: When typing `@` in Team Hub chat, show the existing `MentionMenu` dropdown with all rebar.shop team members. Selecting a mention inserts `@Name` into the message. Mentioned names are rendered as highlighted badges in message bubbles.
2. **Reply**: Add a reply button to each message's hover actions. Clicking it sets a "replying to" banner above the composer showing the original message preview. The reply reference is stored in the database and displayed as a quoted block above the reply message.

### Database Changes (Migration)

Add a `reply_to_id` column to `team_messages`:

```sql
ALTER TABLE public.team_messages
  ADD COLUMN reply_to_id uuid REFERENCES public.team_messages(id) ON DELETE SET NULL;
```

### Code Changes

**File**: `src/components/teamhub/MessageThread.tsx`

1. **@Mention integration**:
   - Import `MentionMenu` from `@/components/chat/MentionMenu`
   - Add state: `mentionOpen`, `mentionFilter`, `mentionIndex`
   - On `@` keypress in textarea, open the mention menu; on selection, replace `@filter` with `@Name` in input
   - Render `MentionMenu` positioned above the composer
   - In message display, parse `@Name` patterns and render them as highlighted `<span>` tags

2. **Reply-to-message**:
   - Add state: `replyTo: TeamMessage | null`
   - Add a Reply button (↩ icon) to the hover action bar next to TTS/delete
   - When clicked, set `replyTo` state and focus the textarea
   - Show a reply preview banner above the composer with the original sender name + truncated text + close button
   - Pass `reply_to_id` when sending via `onSend`

3. **Reply display in messages**:
   - When a message has `reply_to_id`, find the referenced message and render a compact quoted block above the message body (sender name + first line, with a left border accent)

**File**: `src/hooks/useTeamChat.ts`

- Add `reply_to_id` to `TeamMessage` interface
- Include `reply_to_id` in the insert payload of `useSendMessage`
- Update `onSend` callback signature to accept optional `replyToId`

**File**: `src/components/teamhub/MessageThread.tsx` (props update)

- Update `onSend` prop type to include optional `replyToId: string`

**File**: `src/pages/TeamHub.tsx`

- Pass `replyToId` through from `MessageThread.onSend` to `sendMutation`

### Technical Detail

- The `MentionMenu` already queries `profiles_safe` for team members — no new queries needed
- Mention detection: track cursor position in textarea, detect `@` followed by text, filter menu accordingly
- Reply quote rendering: build a `messageMap` (Map of id → message) from the messages array, look up `reply_to_id` to get the quoted message

### Files Changed

| File | Change |
|---|---|
| Migration | Add `reply_to_id` column to `team_messages` |
| `src/hooks/useTeamChat.ts` | Add `reply_to_id` to types + insert |
| `src/components/teamhub/MessageThread.tsx` | Add MentionMenu, reply state, reply UI, mention rendering |
| `src/pages/TeamHub.tsx` | Pass replyToId through onSend |

