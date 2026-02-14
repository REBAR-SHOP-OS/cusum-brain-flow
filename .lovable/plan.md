

# Fix Vizzy: Realtime AI Voice, Video, and Screen Sharing Upgrade

## Overview

Upgrade Vizzy from the current Jitsi iframe + browser SpeechRecognition setup to LiveKit Cloud for video/audio/screen sharing, while keeping ElevenLabs as the AI voice engine and RingCentral for phone calls.

## Current State

- **Vizzy Voice Chat** (`VizzyPage.tsx`): ElevenLabs Conversational AI via WebSocket -- working but audio-only, no video/screen share
- **Team Meetings** (`MeetingRoom.tsx`): Jitsi Meet embedded via iframe with RingCentral Video fallback
- **Meeting Transcription**: Browser SpeechRecognition API (limited accuracy, Chrome-only)
- **Phone Calls**: RingCentral WebRTC via `useWebPhone` + AI bridge via `useCallAiBridge`
- **Recording**: Browser MediaRecorder capturing local mic only

## What Gets Fixed

### 1. Replace Jitsi with LiveKit Cloud for Team Meetings

**Problem**: Jitsi iframe gives no control over tracks, quality, UI, or AI integration.

**Solution**: Use `@livekit/components-react` SDK to build a native meeting experience.

- Install `livekit-client` and `@livekit/components-react`
- Create edge function `livekit-token` that mints JWT room tokens using LiveKit Cloud API keys
- Replace `MeetingRoom.tsx` iframe with LiveKit React components (video grid, audio controls, screen share button)
- Native screen sharing via `room.localParticipant.setScreenShareEnabled(true)`
- Simulcast enabled by default for adaptive quality

### 2. Upgrade Meeting Transcription to ElevenLabs Scribe

**Problem**: Browser SpeechRecognition is Chrome-only and low accuracy.

**Solution**: Replace `useMeetingTranscription.ts` to use the existing `elevenlabs-scribe-token` edge function with `useScribe` from `@elevenlabs/react`.

- Use `useScribe` hook with `scribe_v2_realtime` model and VAD commit strategy
- Connect to meeting audio via LiveKit room audio tracks
- Higher accuracy, works cross-browser

### 3. Add Vizzy AI as a Meeting Participant (Audio)

**Problem**: Vizzy only works on the dedicated VizzyPage, not in team meetings.

**Solution**: Allow Vizzy's ElevenLabs conversational agent to join a LiveKit room as an audio-only participant.

- Create a "Summon Vizzy" button in the meeting UI
- When activated: get ElevenLabs signed URL, capture room audio, bridge AI audio back into the LiveKit room as a published track
- Reuse the proven audio bridging pattern from `useCallAiBridge.ts` (PCM capture, base64 encoding, WebSocket to ElevenLabs, decode AI audio, publish as track)

### 4. Improve Vizzy Voice Page

- Add video capability using LiveKit (optional camera toggle)
- Add screen sharing so CEO can show Vizzy what they're looking at
- Keep all existing features: quotation drafts, make_call, send_sms, silent mode

## Technical Plan

### New Dependencies

- `livekit-client` (JS WebRTC client)
- `@livekit/components-react` (React UI components)

### New Secrets Required

- `LIVEKIT_API_KEY` -- from LiveKit Cloud dashboard
- `LIVEKIT_API_SECRET` -- from LiveKit Cloud dashboard
- `LIVEKIT_URL` -- WebSocket URL (e.g., `wss://your-app.livekit.cloud`)

### New Edge Function: `livekit-token`

Mints JWT tokens with room grants (publish, subscribe, screen_share permissions). Uses `livekit-server-sdk` for Deno or manual JWT signing.

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/livekit-token/index.ts` | Mint LiveKit room JWT tokens |
| `src/hooks/useLiveKitRoom.ts` | Hook wrapping LiveKit room connection, track management |
| `src/components/teamhub/LiveKitMeetingRoom.tsx` | New meeting room component replacing Jitsi iframe |
| `src/hooks/useMeetingAiBridge.ts` | Bridge ElevenLabs AI into a LiveKit room |

### Files to Modify

| File | Change |
|------|--------|
| `src/components/teamhub/MeetingRoom.tsx` | Replace Jitsi iframe with `LiveKitMeetingRoom` |
| `src/hooks/useMeetingTranscription.ts` | Switch from browser SpeechRecognition to ElevenLabs Scribe via `useScribe` |
| `src/hooks/useTeamMeetings.ts` | Update room creation to use LiveKit instead of Jitsi/RingCentral Video |
| `src/pages/VizzyPage.tsx` | Add optional video/screen share via LiveKit room |
| `supabase/config.toml` | Add `[functions.livekit-token]` with `verify_jwt = false` |

### Migration Strategy

- LiveKit Cloud handles TURN/STUN automatically (no coturn deployment needed)
- Existing meeting data (transcripts, recordings) remains untouched
- RingCentral phone calling stays as-is (separate from video meetings)
- ElevenLabs remains the AI voice provider (no change to conversational agent setup)

### Security

- LiveKit tokens are short-lived JWTs minted server-side with scoped room grants
- `LIVEKIT_API_SECRET` stored as edge function secret, never exposed to client
- ElevenLabs signed URLs already follow ephemeral token pattern
- All media encrypted via WebRTC's mandatory DTLS-SRTP

