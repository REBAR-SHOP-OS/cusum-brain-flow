

# Remove All Vizzy Voice Chat Files and References -- Final Cleanup

## What Was Already Done
- Deleted `src/pages/VizzyPage.tsx`
- Deleted `supabase/functions/elevenlabs-conversation-token/` directory
- Removed `/vizzy` route from `App.tsx`
- Removed long-press logic from `FloatingVizzyButton.tsx`
- Removed `/vizzy` from `pageMap.ts`

## What Still Remains (to clean up now)

### 1. Broken hooks that call the deleted edge function

Both of these hooks invoke `elevenlabs-conversation-token` which no longer exists:

- **`src/hooks/useCallAiBridge.ts`** (530 lines) -- Bridges RingCentral calls with ElevenLabs AI. Used by `AccountingAgent.tsx` (Penny phone calls).
- **`src/hooks/useMeetingAiBridge.ts`** (151 lines) -- Bridges ElevenLabs into meetings. Used by `MeetingRoom.tsx`.

**Action:** Delete both hooks and remove their usage from consumers:
- `src/components/accounting/AccountingAgent.tsx` -- Remove `useCallAiBridge` import and `bridgeState`/`startBridge`/`stopBridge` usage
- `src/components/accounting/PennyCallCard.tsx` -- Remove `CallAiBridgeState` type import (replace with inline type or remove props)
- `src/components/teamhub/MeetingRoom.tsx` -- Remove `useMeetingAiBridge` import and all Vizzy meeting bridge state
- `src/components/teamhub/VizzyMeetingPanel.tsx` -- Remove `MeetingAiBridgeState` type import

### 2. ChatInput Headset button labeled "Voice Chat"

**File:** `src/components/chat/ChatInput.tsx` (lines 378-391)

The `onLiveChatClick` Headset button with tooltip "Voice Chat" now just navigates to `/chat` (text chat). Two options:
- **Option A:** Remove the Headset button entirely since it duplicates the FloatingVizzyButton
- **Option B:** Keep it but rename tooltip to "Live Chat"

**Action:** Remove the Headset button and `onLiveChatClick` prop entirely, plus remove the `Headset` icon import. Clean up callers in `Home.tsx` and `AgentWorkspace.tsx` that pass this prop.

### 3. `supabase/config.toml` stale entry

Line 127-128 still has `[functions.elevenlabs-conversation-token]`. This file is auto-managed and cannot be edited directly -- it will be cleaned up automatically.

### 4. `vizzy-context` edge function comment

**File:** `supabase/functions/vizzy-context/index.ts` (line 9)

Comment says "Server-side context endpoint for VizzyPage voice mode" -- update to reflect it serves text chat context.

### 5. `vizzy-briefing` edge function comment

**File:** `supabase/functions/vizzy-briefing/index.ts` (line 7)

Comment references "faster for ElevenLabs to process" -- update to remove ElevenLabs reference.

## Files NOT Touched (intentionally kept)

These use ElevenLabs for **transcription** (not voice chat) and remain valid:
- `src/hooks/useRealtimeTranscribe.ts` -- Uses `elevenlabs-scribe-token` for live transcription
- `supabase/functions/elevenlabs-scribe-token/` -- Scribe token endpoint (transcription)
- `supabase/functions/elevenlabs-transcribe/` -- Batch transcription endpoint
- `src/components/office/TranscribeView.tsx` -- Transcription UI
- `src/components/chat/VoiceInputButton.tsx` -- Speech-to-text input (browser API, not ElevenLabs voice chat)

## Summary of Changes

| Action | File |
|--------|------|
| Delete | `src/hooks/useCallAiBridge.ts` |
| Delete | `src/hooks/useMeetingAiBridge.ts` |
| Modify | `src/components/accounting/AccountingAgent.tsx` -- remove bridge usage |
| Modify | `src/components/accounting/PennyCallCard.tsx` -- remove bridge type |
| Modify | `src/components/teamhub/MeetingRoom.tsx` -- remove bridge usage |
| Modify | `src/components/teamhub/VizzyMeetingPanel.tsx` -- remove bridge type |
| Modify | `src/components/chat/ChatInput.tsx` -- remove Headset button and `onLiveChatClick` prop |
| Modify | `src/pages/Home.tsx` -- remove `onLiveChatClick` prop |
| Modify | `src/pages/AgentWorkspace.tsx` -- remove `onLiveChatClick` prop |
| Modify | `supabase/functions/vizzy-context/index.ts` -- fix comment |
| Modify | `supabase/functions/vizzy-briefing/index.ts` -- fix comment |

