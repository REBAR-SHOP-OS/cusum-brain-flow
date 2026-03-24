

## Add Forward Message Feature to Team Hub Chat

### What
Add a "Forward" button to each message's hover actions. Clicking it opens a dialog listing all Team Hub channels/groups where the user can forward the message. The forwarded message appears in the target channel with a "Forwarded from [Name]" label.

### Changes

**File**: `src/components/teamhub/MessageThread.tsx`

1. Add a Forward icon (`Forward` from lucide-react) to the hover action bar (next to Reply, around line 709-717)
2. Add state: `forwardMsg: TeamMessage | null`
3. Clicking Forward sets `forwardMsg` and opens a dialog

**File**: `src/components/teamhub/ForwardMessageDialog.tsx` (new)

A dialog component that:
- Receives the message to forward, list of channels, current profile
- Shows a list of channels/groups as selectable options
- On select, calls `onForward(targetChannelId, message)` and closes
- Shows a preview of the message being forwarded (text snippet + image thumbnail if any)

**File**: `src/pages/TeamHub.tsx`

1. Import `ForwardMessageDialog`
2. Add state: `forwardMsg: TeamMessage | null`
3. Pass `onForward` callback to `MessageThread` and handle it by:
   - Calling `sendMutation` on the target channel with the forwarded content prefixed with `↪ Forwarded from [SenderName]:\n` + original text + attachments
4. Pass `channels` list to the dialog for channel selection

**File**: `src/components/teamhub/MessageThread.tsx` (props update)

- Add `onForward?: (msg: TeamMessage) => void` prop
- Wire the Forward button to call `onForward(msg)`

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ForwardMessageDialog.tsx` | New dialog with channel list for forwarding |
| `src/components/teamhub/MessageThread.tsx` | Add Forward button + onForward prop |
| `src/pages/TeamHub.tsx` | Handle forward logic, pass channels to dialog |

