

# Replace Music Generation: ElevenLabs → Lyria 3 (Gemini API)

## Summary
Replace the ElevenLabs music generation backend with Google's Lyria 3 model via the Gemini API (`generativelanguage.googleapis.com`). The existing `AudioPromptDialog` UI stays the same. When user submits a music prompt, it generates music via Lyria 3 and replaces the current audio track on the video.

## API Details
- **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/lyria-3-clip-preview:generateContent`
- **Auth**: `x-goog-api-key: GEMINI_API_KEY` (already configured)
- **Request body**: `{ "contents": [{ "parts": [{ "text": "PROMPT" }] }] }`
- **Response**: JSON with base64-encoded audio in `candidates[0].content.parts[0].inlineData.data` (MIME: `audio/mp3`)

## Changes

### 1. New Edge Function: `supabase/functions/lyria-music/index.ts`
- Uses `handleRequest` pattern (per project standards)
- Accepts `{ prompt, duration }` — sends prompt to Lyria 3 `generateContent` endpoint
- Returns raw audio binary response (like current `elevenlabs-music`)
- Uses `GEMINI_API_KEY` from env
- `authMode: "none"`, `rawResponse: true`

### 2. Update: `src/components/ad-director/ProVideoEditor.tsx`
- In `handleAudioGenerate` (~line 253): change `elevenlabs-music` → `lyria-music` for music type
- Keep voiceover path (`elevenlabs-tts`) unchanged
- Keep the enhance-music-prompt step (Step 1) unchanged

### 3. No UI changes
- `AudioPromptDialog` stays as-is (same prompt + duration + type selector)

## Files Changed
- `supabase/functions/lyria-music/index.ts` — new edge function
- `src/components/ad-director/ProVideoEditor.tsx` — swap function name

