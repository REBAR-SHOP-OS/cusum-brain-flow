

## Two Changes: Vizzy Silent Mode + Remove Chat Icon

### 1. Remove the MessageCircle (Live Chat) icon from ChatInput toolbar

The circled chat bubble icon in the toolbar will be removed entirely. The `LiveChatWidget` event trigger and the `MessageCircle` import will be cleaned up from `ChatInput.tsx`.

### 2. Vizzy "Silent Mode" -- voice-activated mute/unmute

When you tell Vizzy to be silent (e.g., "silent", "be quiet", "shut up", "hush"), she will immediately go quiet -- muting her output and only silently recording your words as notes. She stays in this mode until you call her by name (e.g., "Vizzy", "hey Vizzy"), at which point she resumes speaking normally.

**How it works:**

- A new `silentMode` state is added to `VizzyPage.tsx`
- The `onMessage` handler watches incoming user transcripts for trigger phrases:
  - **Silence triggers**: "silent", "be quiet", "shut up", "hush", "shhh"
  - **Wake triggers**: "vizzy", "hey vizzy"
- When silent mode activates:
  - Volume is set to 0 via `conversation.setVolume({ volume: 0 })`
  - A contextual update is sent: "CEO asked you to be silent. Do NOT speak. Just listen and take mental notes. Only respond when the CEO calls your name 'Vizzy'."
  - The UI status label shows "Silent mode -- taking notes..."
- When the user says "Vizzy":
  - Volume is restored to previous level
  - A contextual update is sent: "CEO called your name. You may speak again. Briefly summarize any notes from the silent period."
  - Normal status labels resume

### Technical Details

**Files to modify:**

1. **`src/components/chat/ChatInput.tsx`**
   - Remove the `MessageCircle` import from lucide-react
   - Remove the entire tooltip button block that dispatches `"toggle-live-chat"`
   - No other toolbar buttons are affected

2. **`src/pages/VizzyPage.tsx`**
   - Add `silentMode` state (`useState(false)`)
   - Add `prevVolumeRef` ref to remember volume before muting
   - In the `onMessage` handler for `user_transcript`, after recording the entry, check the transcript text against silence/wake keywords
   - On silence trigger: set `silentMode(true)`, save current volume, set volume to 0, send contextual update
   - On wake trigger: set `silentMode(false)`, restore volume, send contextual update
   - Update the `statusLabel` to show "Silent mode -- taking notes..." when `silentMode` is true
   - Add a visual indicator (e.g., a small "SILENT" badge or dimmed avatar ring) so you know she's in silent mode

