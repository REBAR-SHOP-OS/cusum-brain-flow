

# Transcribe Upgrade — ElevenLabs STT + LLM Intelligence + Apple Watch Mode

## Current State

The Transcribe system currently:
- Records audio via browser MediaRecorder, then sends the entire blob to a `transcribe-translate` edge function
- Uses Gemini 2.5 Pro for both transcription AND translation (two passes)
- No real-time streaming — user must wait until recording finishes to see anything
- Output is limited to translation only (no summaries, action items, or meeting notes)
- No mobile/wearable optimization
- ElevenLabs API key and SDK are already configured in the project (used for Vizzy voice agent)

## What We Will Build

### 1. ElevenLabs Scribe v2 Realtime — Live Streaming Transcription

Replace the "record then send" flow with ElevenLabs `scribe_v2_realtime` via the `useScribe` hook from `@elevenlabs/react` (already installed). Words appear on screen as the user speaks — zero wait time.

- New edge function `elevenlabs-scribe-token` to generate single-use tokens
- Frontend uses `useScribe` hook with VAD commit strategy
- Live partial transcripts render in real-time with a typing animation
- Committed transcripts stack below with timestamps

### 2. ElevenLabs Scribe v2 Batch — File Upload Transcription

Replace Gemini audio transcription for file uploads with ElevenLabs batch STT (`scribe_v2`). This gives:
- Native speaker diarization (much more accurate than prompt-based)
- Word-level timestamps
- Audio event tagging (laughter, applause, music)
- 99+ language support

New edge function `elevenlabs-transcribe` handles file uploads.

### 3. LLM Post-Processing Options (Gemini 3 Flash)

After transcription (from either realtime or batch), offer AI-powered post-processing via a toolbar:

| Option | Description |
|--------|-------------|
| Translate | Translate to any of 48 supported languages (existing capability, upgraded) |
| Summarize | Generate a concise summary of the transcript |
| Action Items | Extract tasks with assignees and priorities |
| Meeting Notes | Structured notes: key points, decisions, follow-ups |
| Clean Up | Remove filler words, fix grammar, polish prose |
| Custom Prompt | Free-text instruction for custom processing |

Each option calls the existing `transcribe-translate` edge function with a new `postProcess` mode, using Gemini 3 Flash for speed.

### 4. Apple Watch Companion Mode

Since we cannot build a native watchOS app, we will build a **PWA-optimized compact UI** designed for small screens (Apple Watch Ultra browser / iPhone companion):

- A dedicated `/transcribe/watch` route with a minimal, large-button interface
- Single giant mic button (entire screen is tappable)
- Real-time transcript displayed in large, high-contrast text
- Auto-saves transcriptions to the database for later review on desktop
- Haptic feedback via `navigator.vibrate()` on start/stop
- Works offline via existing PWA service worker (records locally, syncs when online)

### 5. Enhanced Main UI

Redesign the Transcribe page with:
- **Live waveform visualizer** during recording (using `getInputByteFrequencyData`)
- **Real-time transcript** appearing word-by-word as user speaks
- **Post-processing toolbar** below the transcript with one-click actions
- **Multi-language output** — translate to ANY language (not just English)
- **Session persistence** — save transcriptions to database for later access
- **Export options** — TXT, SRT (subtitles), JSON, PDF

---

## Technical Details

### New Edge Functions

| Function | Purpose |
|----------|---------|
| `elevenlabs-scribe-token` | Generate single-use tokens for realtime STT |
| `elevenlabs-transcribe` | Batch transcription of uploaded audio files |

### Modified Edge Functions

| Function | Changes |
|----------|---------|
| `transcribe-translate` | Add `postProcess` modes: summarize, action-items, meeting-notes, cleanup, custom. Upgrade model to gemini-3-flash-preview. Keep existing translate mode. |

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/elevenlabs-scribe-token/index.ts` | Token endpoint for realtime STT |
| `supabase/functions/elevenlabs-transcribe/index.ts` | Batch file transcription via ElevenLabs |
| `src/hooks/useRealtimeTranscribe.ts` | Wrapper around `useScribe` with token fetching and state management |
| `src/components/transcribe/LiveTranscript.tsx` | Real-time word-by-word transcript display |
| `src/components/transcribe/PostProcessToolbar.tsx` | AI action buttons (Summarize, Action Items, etc.) |
| `src/components/transcribe/AudioWaveform.tsx` | Visual waveform during recording |
| `src/components/transcribe/WatchMode.tsx` | Compact Apple Watch / small-screen UI |
| `src/pages/TranscribeWatch.tsx` | Route for `/transcribe/watch` |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/office/TranscribeView.tsx` | Major rewrite: integrate realtime STT, post-processing toolbar, multi-language output, new export options |
| `supabase/functions/transcribe-translate/index.ts` | Add post-processing modes, upgrade to gemini-3-flash-preview |
| `src/App.tsx` | Add `/transcribe/watch` route |
| `supabase/config.toml` | Register new edge functions |

### Database (Optional — Session Persistence)

New `transcription_sessions` table to save transcriptions for later review:
- id, profile_id, title, raw_transcript, processed_output, process_type, source_language, target_language, duration_seconds, speaker_count, company_id, created_at
- RLS: users see own sessions, admins see all

### ElevenLabs Scribe Token Edge Function

```text
1. Verify auth
2. Fetch single-use token from https://api.elevenlabs.io/v1/single-use-token/realtime_scribe
3. Return { token } to client
```

### Post-Processing Logic (Edge Function)

```text
switch (postProcess):
  "translate"      -> existing two-pass translation flow
  "summarize"      -> system prompt: "Summarize this transcript concisely..."
  "action-items"   -> system prompt: "Extract actionable tasks with assignees..."
  "meeting-notes"  -> system prompt: "Structure as: Key Points, Decisions, Action Items, Follow-ups..."
  "cleanup"        -> system prompt: "Clean up filler words, fix grammar, polish..."
  "custom"         -> user provides their own instruction
```

### Apple Watch Mode Design

```text
+------------------+
|                  |
|    [LARGE MIC]   |   <- entire top half tappable
|                  |
|------------------|
|  Live text here  |   <- high contrast, large font
|  scrolling up    |
|                  |
|  [Save] [Clear]  |   <- bottom action bar
+------------------+
```

- Dark background, white text, minimum 18px font
- No sidebar, no header, no navigation chrome
- Auto-saves on stop
- Vibration feedback on start/stop

