
# Remove Voice Chat and Related Dead Code

## What Gets Removed

### Files to Delete
| File | Reason |
|------|--------|
| `src/hooks/useVoiceChat.ts` | Core voice chat hook (listen/think/speak loop) |
| `src/components/chat/VoiceOrb.tsx` | Voice orb UI component |
| `supabase/functions/elevenlabs-tts/index.ts` | Gemini TTS edge function used only by voice chat |

### Files to Modify

**`src/pages/LiveChat.tsx`** -- Remove all voice chat references:
- Remove imports: `useVoiceChat`, `VoiceOrb`, `Headset`, `Mic` (icon)
- Remove `voiceMode` state and `voiceChat` hook
- Remove the Voice Mode toggle button in the header (Headset icon)
- Remove the entire voice mode orb/transcript overlay section (lines 288-323)
- Remove the `voiceMode` condition wrapping the input area (line 334) -- input should always show
- Remove the Mic button that launches voice chat (lines 418-429)
- Keep: `speech` (useSpeechRecognition for text voice input), `VoiceInputButton`, all other chat functionality

## What Stays (Not Affected)
- `src/hooks/useSpeechRecognition.ts` -- still used by ChatInput, ComposeEmailDialog, VoiceRecorderWidget, LiveCallPanel
- `src/components/chat/VoiceInputButton.tsx` -- still used for voice-to-text input in chat
- `src/components/shopfloor/VoiceRecorderWidget.tsx` -- shopfloor translation widget
- `src/components/phonecalls/LiveCallPanel.tsx` -- call transcription
- `supabase/functions/transcribe-translate/` -- used by VoiceRecorderWidget
- `src/hooks/useMeetingTranscription.ts` -- meeting transcription

## Summary
3 files deleted, 1 file modified. All voice-to-text input features remain intact -- only the conversational voice chat (orb, TTS playback, listen/think/speak loop) is removed.
