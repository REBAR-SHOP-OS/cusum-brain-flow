

## Switch Nila to Direct Gemini API with Native Audio Model

### Problem
The `nila-chat` edge function currently uses the Lovable AI gateway with `gemini-2.5-flash-lite`. The user wants it to use **only** `gemini-2.5-flash-native-audio-preview-12-2025` via the direct Gemini API (the project already has `GEMINI_API_KEY` configured and uses it in other functions).

The mode switching (1=normal, 2=silent, 3=translate) already works in the frontend hook. No frontend changes needed.

### Changes

**File: `supabase/functions/nila-chat/index.ts`**

- Switch from Lovable AI gateway (`ai.gateway.lovable.dev`) to direct Gemini API (`generativelanguage.googleapis.com/v1beta/openai/chat/completions`)
- Use `GEMINI_API_KEY` instead of `LOVABLE_API_KEY`
- Set model to `gemini-2.5-flash-native-audio-preview-12-2025`
- Update system prompt to explicitly state: "Reply in the same language the user speaks. If they speak Persian, reply in Persian. If English, reply in English."
- Keep the translate mode prompt as-is
- Keep streaming, error handling, and CORS unchanged

**Deploy `nila-chat`** edge function.

### Technical Detail

The direct Gemini API uses the same OpenAI-compatible endpoint format that the project already uses in `geminiAdapter.ts` and `aiRouter.ts`:
```
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Authorization: Bearer ${GEMINI_API_KEY}
model: "gemini-2.5-flash-native-audio-preview-12-2025"
```

| File | Change |
|---|---|
| `nila-chat/index.ts` | Switch to direct Gemini API, use native audio model, multilingual prompt |
| Deploy `nila-chat` | Redeploy |

