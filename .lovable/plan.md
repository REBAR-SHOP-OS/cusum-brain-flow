

# Fix: Script Analysis Timeout

## Problem
The `analyze-script` task uses `openai/gpt-5` (8192 tokens + tool calling), which is too slow for the edge function's ~60s timeout. The spinner hangs until the connection drops.

## Solution
Switch `analyze-script` (and other GPT-led tasks) to use faster Gemini models via the Lovable AI gateway. Gemini 2.5 Pro handles structured tool-calling well and responds 3-5x faster than GPT-5.

### Changes to `supabase/functions/ad-director-ai/index.ts`

Update the `MODEL_ROUTES` table:

| Task | Before | After |
|------|--------|-------|
| analyze-script | `openai/gpt-5` → fallback `gemini-2.5-pro` | `google/gemini-2.5-pro` → fallback `google/gemini-2.5-flash` |
| generate-storyboard | `openai/gpt-5` → fallback `gemini-2.5-pro` | `google/gemini-2.5-pro` → fallback `google/gemini-2.5-flash` |
| write-cinematic-prompt | `openai/gpt-5` → fallback `gemini-2.5-pro` | `google/gemini-2.5-pro` → fallback `google/gemini-2.5-flash` |
| improve-prompt | `openai/gpt-5` → fallback `gemini-2.5-pro` | `google/gemini-2.5-pro` → fallback `google/gemini-2.5-flash` |
| rewrite-cta | `openai/gpt-5-mini` → fallback `gemini-2.5-flash` | `google/gemini-2.5-flash` → fallback `google/gemini-2.5-flash-lite` |
| generate-voiceover | `openai/gpt-5-mini` → fallback `gemini-2.5-flash` | `google/gemini-2.5-flash` → fallback `google/gemini-2.5-flash-lite` |
| optimize-ad | `openai/gpt-5` → fallback `gemini-2.5-pro` | `google/gemini-2.5-pro` → fallback `google/gemini-2.5-flash` |

This eliminates OpenAI models entirely from this function — all tasks use Gemini which is faster through the Lovable AI gateway and avoids the `temperature` / `max_tokens` parameter incompatibilities that have caused repeated 400/500 errors.

The temperature-skip logic for OpenAI models becomes a no-op safety net (kept for future-proofing).

