

# Speaker Identification, Faster Translation, Silence Handling & Auto-Scroll

## Changes

### 1. Auto-Scroll for Both Columns — `src/pages/AzinInterpreter.tsx`
The two-column layout uses `ScrollArea` but has no auto-scroll. Add refs to both English and Farsi columns and scroll to bottom whenever `committedTranscripts` or `partialText` changes.

```tsx
const enBottomRef = useRef<HTMLDivElement>(null);
const faBottomRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  enBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  faBottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [committedTranscripts, partialText]);

// Add <div ref={enBottomRef} /> at end of English column content
// Add <div ref={faBottomRef} /> at end of Farsi column content
```

### 2. Speaker Identification — `src/hooks/useAzinVoiceInterpreter.ts`
Add speaker diarization instructions to the system prompt:

- Instruct the model to identify distinct speakers as **Speaker A** and **Speaker B** based on voice characteristics
- Prefix each translation with `[A]` or `[B]` to indicate which speaker said it
- Add to RULE 1: "If you can distinguish two different voices, label them [A] and [B] consistently throughout the session"

### 3. Faster Translation & Stricter Silence — `src/hooks/useAzinVoiceInterpreter.ts`
- Reduce `silenceDurationMs` from `1000` → `500` for faster turn-taking
- Reduce `prefixPaddingMs` from `300` → `150` for quicker response start
- Strengthen the ambient noise rule in the prompt: explicitly state that TV sounds, music, distant conversations, and environmental noise must produce ZERO output

### 4. Stronger Noise Filtering — `src/hooks/useVoiceEngine.ts`
The existing client-side filter already blocks fragments < 3 words / < 10 chars. No change needed here — the prompt hardening handles ambient noise.

## Files
- `src/pages/AzinInterpreter.tsx` — add auto-scroll refs
- `src/hooks/useAzinVoiceInterpreter.ts` — speaker labels, faster timing, stricter silence rules

