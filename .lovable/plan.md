

## Revert Vizzy to Avatar-Centered Voice UI (No Chat Transcript)

### What Changes

Replace the current chat-bubble layout with the original centered avatar design shown in your screenshot: a large brain icon in the center, "Vizzy is speaking..." / "Listening..." status text below it, dark overlay background -- while keeping all the new features (mute, volume, reconnect, timer, quotation drafting).

### Layout

- **Full-screen dark overlay** with blurred background
- **Centered brain avatar** (large circle, pulsing ring when speaking)
- **Status text** below avatar: "Connecting...", "Vizzy is speaking...", "Listening...", "Reconnecting..."
- **Close (X) button** top-right corner (red circle, like screenshot)
- **Bottom control bar** with: Mute mic, Volume slider, Reconnect button, Timer display, Camera button (bottom-left)
- **No chat transcript** -- remove all the message bubbles and scroll area
- **Quotation cards** appear as a floating overlay/dialog in the center when Vizzy drafts one, with Approve/Dismiss buttons

### Technical Details

**File: `src/pages/VizzyPage.tsx`** (full rewrite of the UI portion only, logic stays)

1. Remove the header bar, chat transcript scroll area, and bottom status bar
2. Replace with:
   - Fixed full-screen container with `bg-black/90 backdrop-blur`
   - Centered `motion.div` for the brain avatar with animated ring (scales/glows when `conversation.isSpeaking`)
   - Status label below avatar
   - Red X button positioned top-right
   - Bottom toolbar row with mic mute, volume, reconnect, timer icons
   - Camera button bottom-left (for photo analysis)
3. Quotation card renders as a centered floating card (like a modal overlay) instead of inline chat bubble
4. All existing logic preserved: transcript tracking (kept in refs for memory/persistence), reconnect, mute, volume, quotation client tool, session save

### Files Modified

- `src/pages/VizzyPage.tsx` -- Rewrite the render/return JSX to match the avatar-centered design; keep all hooks and logic intact

