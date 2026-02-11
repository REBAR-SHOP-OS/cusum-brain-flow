

## Fix: Live Microphone Translation (Record Real Audio Instead of Browser Speech API)

### The Problem
The Microphone tab uses the browser's built-in `SpeechRecognition` API, which:
- Only works well for English
- Produces garbage or nothing for Farsi, Hindi, Georgian, Arabic, Turkish, Urdu, and other languages
- Cannot do speaker diarization or confidence scoring

The Upload File tab works perfectly because it sends actual audio to the AI-powered backend for transcription.

### The Fix
Replace the browser `SpeechRecognition` approach with `MediaRecorder` — capture real audio from the microphone, then send it to the same `transcribe-translate` backend function that file uploads use.

### Changes to `src/components/office/TranscribeView.tsx`

**Remove**: All `SpeechRecognition` logic (`recognitionRef`, `accumulatedTextRef`, `interimText`, `onresult` handler, auto-restart on `onend`)

**Add**: `MediaRecorder`-based recording:

```text
[User clicks "Start Recording"]
       |
       v
  navigator.mediaDevices.getUserMedia({ audio: true })
       |
       v
  MediaRecorder collects audio chunks
  Timer shows elapsed time
  Visual pulse animation indicates recording
       |
  [User clicks "Stop & Translate"]
       |
       v
  Combine chunks into audio Blob
  Create FormData with the audio blob
  Send to transcribe-translate (same as file upload)
       |
       v
  Display results: original transcript, English translation,
  confidence score, speaker diarization
```

**Specific code changes:**

1. **`startListening` function** — Replace SpeechRecognition with:
   - `navigator.mediaDevices.getUserMedia({ audio: true })` to get mic stream
   - Create `MediaRecorder` with webm/opus format
   - Collect chunks in array via `ondataavailable`
   - Start recording timer

2. **`stopListening` function** — Replace text accumulation with:
   - Stop MediaRecorder
   - Combine chunks into a single audio Blob
   - Build FormData (same format as file upload)
   - Call `callTranslateAPI(formData, true)` — same path as file upload
   - Display results

3. **Remove unused state**: `interimText`, `accumulatedTextRef`, `wordCount` display during recording (replaced by timer-only display)

4. **UI during recording**: Show a simple recording indicator with elapsed time and a pulsing mic icon (no live transcript preview since the AI processes audio after stop)

5. **Recording indicator text**: Change from "Listening..." to "Recording... speak in any language" to make it clear all languages are supported

### What This Fixes
- Farsi, Hindi, Georgian, Arabic, Turkish, Urdu, and ALL other languages now work from the microphone
- Speaker diarization works for mic recordings (multiple speakers detected)
- Confidence scores are generated for mic recordings
- Same high-quality two-pass Gemini pipeline used for both mic and file upload

### What Changes for the User
- Instead of seeing live interim text while speaking, they see a recording timer
- After stopping, there's a brief processing delay (same as file upload) before results appear
- All languages work perfectly from the microphone

### Files Modified
- `src/components/office/TranscribeView.tsx` — Replace SpeechRecognition with MediaRecorder (~40 lines changed)

### No Other Changes
- No edge function changes needed (reuses existing `transcribe-translate`)
- No schema changes
- No new dependencies

