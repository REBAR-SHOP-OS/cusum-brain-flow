

# Add Voice Recorder to Command Hub

## What This Adds

A compact voice recorder widget on the Command Hub (`/shop-floor`) page -- a floating microphone button that expands into a mini recorder panel. Workers can quickly record voice memos, which get transcribed and translated to English using the existing `transcribe-translate` backend function.

## Changes

### 1. New Component: `src/components/shopfloor/VoiceRecorderWidget.tsx`

A self-contained floating widget with:
- A circular mic button (matching the dark Command Hub theme)
- When active, expands to show:
  - Live waveform/pulse animation while recording
  - Real-time interim transcription text
  - Stop button
  - On stop: shows the transcribed + translated English text
  - Copy and dismiss buttons
- Uses browser `SpeechRecognition` for live transcription
- Calls the existing `transcribe-translate` edge function for AI translation to English
- Styled to match the dark Command Hub aesthetic (card/50 backdrop-blur, primary accent)

### 2. Modified: `src/pages/ShopFloor.tsx`

- Import and render `VoiceRecorderWidget` as a fixed-position element in the bottom-right corner of the Command Hub
- Positioned above the "Back to Entry Screen" link

## Technical Details

### VoiceRecorderWidget Component

```text
VoiceRecorderWidget
  State: idle | listening | processing | result
  
  [idle] --> Floating mic button (bottom-right)
  [listening] --> Expanded panel with pulse animation + interim text
  [processing] --> Loading spinner while AI translates
  [result] --> Shows original + English text, copy/dismiss buttons
```

### Integration with existing backend
- Reuses `supabase/functions/transcribe-translate` (already deployed)
- Same API call pattern as TranscribeView: `{ mode: "text", text, sourceLang: "auto" }`
- No new edge functions or database changes needed

### Styling
- Fixed position bottom-right corner
- Dark glass-morphism card matching Command Hub theme
- Primary color accent for the mic button
- Pulse animation when actively listening
- Compact footprint -- does not obstruct hub cards

