

# Fix Voice Input + Build AI-Driven Meeting System

## Issue 1: Microphone Button Not Working on Home Page

The voice input button uses the browser's `SpeechRecognition` API (Web Speech API). On iOS Safari and some mobile browsers, this API is either unsupported or requires HTTPS + user gesture. When `isSupported` is `false`, the button returns `null` and is completely hidden -- but even when visible, the SpeechRecognition API can silently fail on mobile.

**Fix:** Add a visible error state and toast notification when voice input fails, so users know what happened. Also add a fallback: if SpeechRecognition is not supported, show the button but prompt the user that their browser doesn't support it.

## Issue 2: AI-Driven Meeting System with Recording

The current meeting system has the right pieces but needs to be made fully automatic ("AI-driven"). Here's what will change:

### Auto-Start Recording and Transcription
- When a meeting starts, **automatically begin recording** (not just for the creator -- for all participants)
- **Auto-start transcription** is already in place
- Remove the manual record button; recording is always-on

### Auto-Generate AI Notes During Meeting
- The live notes panel already calls `meeting-live-notes` every 60s -- this stays as-is but will trigger on the first 5 entries instead of waiting for 10

### Auto-Summarize on End
- When a meeting ends, the `summarize-meeting` edge function is already triggered automatically
- The meeting report dialog already shows after a short delay

### Changes Summary

**`src/hooks/useSpeechRecognition.ts`**
- Add error callback so the UI can show a toast when mic access is denied or API unsupported

**`src/components/chat/ChatInput.tsx`**
- Show a toast when voice input fails or is unsupported

**`src/components/teamhub/MeetingRoom.tsx`**
- Auto-start recording on mount (remove manual record button)
- Auto-stop recording on end/leave
- Always show the REC badge when active

**`src/hooks/useMeetingRecorder.ts`**
- Remove the `isCreator` guard so any participant can record
- Auto-start capability

**`src/components/teamhub/MeetingNotesPanel.tsx`**
- Lower the auto-analyze threshold from 10 entries to 5
- Start first analysis after 30 seconds instead of 60

**`supabase/functions/ringcentral-video/index.ts`**
- No changes needed -- fallback to Jitsi is already graceful

## Technical Details

### Voice Input Fix
```text
ChatInput.tsx:
  handleVoiceToggle() --> if !speech.isSupported --> toast("Voice input not supported on this browser")
  speech.start() error --> toast("Microphone access denied")

useSpeechRecognition.ts:
  Add onError callback parameter
  Surface "not-allowed" and "no-speech" errors
```

### Auto-Recording Flow
```text
MeetingRoom mount
  --> useEffect auto-calls startRecording()
  --> useEffect auto-starts transcription (already done)
  
MeetingRoom unmount / end
  --> stopRecording() + stopTranscription() (already done)
  --> summarize-meeting fires (already done)
```

### Files Changed
1. `src/hooks/useSpeechRecognition.ts` -- error surfacing
2. `src/components/chat/ChatInput.tsx` -- toast on voice failure  
3. `src/components/teamhub/MeetingRoom.tsx` -- auto-start recording, remove manual button
4. `src/hooks/useMeetingRecorder.ts` -- remove creator-only guard, add auto-start
5. `src/components/teamhub/MeetingNotesPanel.tsx` -- faster first AI analysis

