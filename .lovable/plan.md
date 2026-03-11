

## Fix: Auto-fallback from Veo to Sora on quota errors

The Veo API is returning 429 (RESOURCE_EXHAUSTED). The fix adds automatic Sora fallback when Veo scenes fail, plus updates the GEMINI_API_KEY.

### Step 1 — Update GEMINI_API_KEY secret

Update the existing secret to the new key value you provided.

### Step 2 — Modify `generate-video/index.ts` (lines ~499-513)

In the `generate-multi` action, wrap each scene's `veoGenerate` call with a try/catch that detects 429 errors and retries with `soraGenerate` using `GPT_API_KEY`:

```text
for each scene prompt:
  try veoGenerate(geminiKey, prompt, duration)
  catch (429 / quota error):
    if GPT_API_KEY exists → soraGenerate(gptKey, prompt, duration)
    else → add to errors
```

Same pattern for single `generate` action (lines ~458-473): try Veo first, catch 429, fallback to Sora.

### Step 3 — Update poll-multi to handle mixed providers

The poll-multi action already handles mixed providers per-job (line 548: `job.provider === "veo" ? geminiKey : gptKey`), so no changes needed there.

### Files modified

| File | Change |
|------|--------|
| `supabase/functions/generate-video/index.ts` | Add Veo→Sora fallback on 429 in `generate` and `generate-multi` actions |

### No database changes needed

