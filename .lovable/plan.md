

# Fix Vizzy: RingCentral Video + ElevenLabs AI Upgrade

## Overview

Upgrade Vizzy's meeting experience using **RingCentral Video** (already integrated) as the primary video provider, while upgrading transcription to ElevenLabs Scribe and adding Vizzy AI as a meeting participant.

## Current State

- **Vizzy Voice Chat** (`VizzyPage.tsx`): ElevenLabs Conversational AI via WebSocket — working, audio-only
- **Team Meetings** (`MeetingRoom.tsx`): RingCentral Video bridge (opens in external tab) with Jitsi iframe fallback
- **Meeting Transcription**: Browser SpeechRecognition API (Chrome-only, low accuracy)
- **Phone Calls**: RingCentral WebRTC via `useWebPhone` + AI bridge via `useCallAiBridge`
- **Recording**: Browser MediaRecorder capturing local mic only
- **RingCentral Video Edge Function**: Already creates RC Video bridges with join URLs

## What Gets Fixed

### 1. Make RingCentral Video the Primary Meeting Provider

**Current**: RC Video creates bridges but opens externally. Falls back to Jitsi iframe.

**Fix**: 
- RC Video stays as primary provider (opens in new tab via existing bridge flow)
- Remove Jitsi fallback entirely — RC Video is the only provider
- Improve the "waiting" UI shown while user is in RC Video tab
- Show meeting status, participant info, and AI tools in the Rebar app while RC Video runs in another tab

### 2. Upgrade Meeting Transcription to ElevenLabs Scribe

**Problem**: Browser SpeechRecognition is Chrome-only and low accuracy.

**Solution**: Replace `useMeetingTranscription.ts` to use the existing `elevenlabs-scribe-token` edge function.

- Use local mic capture → send audio to ElevenLabs Scribe API for transcription
- Higher accuracy, works cross-browser
- Keep existing realtime transcript sync via Supabase

### 3. Add Vizzy AI as a Meeting Companion

**Problem**: Vizzy only works on the dedicated VizzyPage, not during meetings.

**Solution**: Add a "Summon Vizzy" panel in the meeting UI that:
- Captures local mic audio (same mic used for RC Video)
- Bridges to ElevenLabs conversational AI (reuse pattern from `useCallAiBridge.ts`)
- Plays AI audio locally (not injected into RC Video call)
- Shows live transcript of Vizzy's responses
- Vizzy can listen to meeting context and provide real-time assistance

### 4. Improve Vizzy Voice Page

- Keep all existing features: quotation drafts, make_call, send_sms, silent mode
- No video/screen share changes needed (RC Video handles this separately)

## Technical Plan

### No New Dependencies Required

RingCentral Video is already integrated. ElevenLabs is already integrated.

### No New Secrets Required

All secrets already configured: `RINGCENTRAL_CLIENT_ID`, `RINGCENTRAL_CLIENT_SECRET`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`

### Files to Modify

| File | Change |
|------|--------|
| `src/components/teamhub/MeetingRoom.tsx` | Remove Jitsi iframe, improve RC Video UI, add Vizzy companion panel |
| `src/hooks/useMeetingTranscription.ts` | Switch from browser SpeechRecognition to ElevenLabs Scribe |
| `src/hooks/useTeamMeetings.ts` | Remove Jitsi fallback, RC Video only |
| `src/hooks/useMeetingAiBridge.ts` (NEW) | Bridge ElevenLabs AI for meeting companion |

### Migration Strategy

- Existing meeting data (transcripts, recordings) remains untouched
- RingCentral phone calling stays as-is
- ElevenLabs remains the AI voice provider
