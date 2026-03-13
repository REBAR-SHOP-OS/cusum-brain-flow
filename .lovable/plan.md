

# Improve Persian Translation Quality

## Problem
The current prompts simply say "Translate the caption to Farsi (Persian)" — this produces literal, mediocre translations. The user wants high-quality, natural, eloquent Persian translations that convey the meaning beautifully.

## Changes

### 1. `supabase/functions/ai-agent/index.ts` — `generateDynamicContent` prompt (~line 91-92)

Replace the simple translation instructions with detailed quality guidance:

```
4. Translate the caption to Farsi (Persian) — this MUST be a premium-quality, natural-sounding Persian translation. Do NOT translate word-by-word. Instead, rewrite the meaning in beautiful, fluent Persian that sounds like it was originally written by a native Persian copywriter. Use elegant vocabulary, proper Persian grammar, and a professional advertising tone. The translation should feel natural and compelling to a Persian-speaking audience.
5. Translate the image slogan to Farsi (Persian) — same quality standard: fluent, catchy, natural Persian. Not a literal translation.
```

### 2. `supabase/functions/regenerate-post/index.ts` — caption-only prompt (~line 307)

Replace:
```
- Translate the caption to Farsi (Persian).
```
With:
```
- Translate the caption to Farsi (Persian). This MUST be a beautiful, fluent, native-quality Persian translation — NOT a word-by-word translation. Rewrite the meaning in elegant, professional Persian that sounds like it was originally written by a native Persian advertising copywriter.
```

### 3. `supabase/functions/auto-generate-post/index.ts` — same treatment for `farsi_translation` instruction in the prompt

### Files
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`
- `supabase/functions/auto-generate-post/index.ts`

