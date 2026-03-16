

# Fix: Faster Translation + Remove Farsi from English Transcript

## Problems (from screenshot)
1. **Farsi showing in the main English transcript area**: The `LiveTranscript` component displays the original text (Farsi) as a subtitle under the English translation. The user wants the main transcript area to show **only English** — no Farsi at all.
2. **Translation speed**: The right panel translates one segment at a time sequentially. Can be improved by using a faster model and batching.

## Changes

### 1. `src/components/transcribe/LiveTranscript.tsx`
- **Remove the original text subtitle line** (lines 50-52) that shows `t.text` in Farsi below the English translation
- The main transcript should only show `t.translatedText || t.text` (English) with no Farsi fallback display

### 2. `src/hooks/useRealtimeTranscribe.ts`
- Use `invokeEdgeFunction` or direct fetch instead of `supabase.functions.invoke` for faster response (avoids SDK overhead)
- No model change needed here — it's already calling `translate-message`

### 3. `src/components/office/TranscribeView.tsx` (right panel translation)
- **Batch translate**: Instead of translating each segment individually, batch multiple new segments into a single `translate-message` call when possible (send array of texts)
- Current approach fires N separate API calls for N segments — consolidating reduces latency

### 4. `supabase/functions/translate-message/index.ts`
- Already uses `gemini-2.5-flash-lite` which is the fastest. No change needed.

## Summary of visible changes
- Main transcript (center): English only, no Farsi subtitles
- Right panel: Farsi translations still show original text as reference (this is the correct place for bilingual view)
- Faster translation via reduced API call overhead

