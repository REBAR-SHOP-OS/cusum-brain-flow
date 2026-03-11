

## Smart SEO-Driven Media Suggestions

Replace hardcoded prompt suggestions in both Video and Image generators with AI-generated ones based on your SEO keywords and brand kit.

### Architecture

```text
Client (hook) → fetches top 10 keywords from seo_keyword_ai
              → fetches brand_kit data
              → calls ai-media-suggestions edge function
              → receives 4 tailored prompts
              → displays in UI (with skeleton loading + fallback)
```

Uses your existing **GEMINI_API_KEY** via the shared `aiRouter.ts` (gemini-2.5-flash-lite for speed/cost).

### Files to create/modify

| File | Action |
|------|--------|
| `supabase/functions/ai-media-suggestions/index.ts` | **New** — edge function that takes `type`, `keywords[]`, `brand_context` and returns 4 prompt suggestions via Gemini |
| `src/hooks/useSeoSuggestions.ts` | **New** — React Query hook that fetches SEO keywords + brand kit, calls the edge function, caches 10 min |
| `src/components/social/VideoGeneratorDialog.tsx` | **Update** — use `useSeoSuggestions("video")`, show skeletons while loading, fallback to hardcoded |
| `src/components/social/ImageGeneratorDialog.tsx` | **Update** — same pattern with `useSeoSuggestions("image")` |
| `supabase/config.toml` | **Update** — add `[functions.ai-media-suggestions]` entry |

### Edge function logic

- Receives `{ type: "video"|"image", keywords: [{keyword, opportunity_score, impressions_28d, intent}], brand_context: {business_name, description, value_prop} }`
- Builds a system prompt instructing Gemini to generate 4 creative media prompts that naturally incorporate the top SEO keywords
- Uses `callAI` from `_shared/aiRouter.ts` with `gemini-2.5-flash-lite`
- Returns `{ suggestions: string[] }`

### Hook logic (`useSeoSuggestions`)

- Fetches user's company → domain → top 10 keywords from `seo_keyword_ai` ordered by `opportunity_score DESC`, then `impressions_28d DESC`
- Fetches brand kit via `useBrandKit()`
- Calls `supabase.functions.invoke("ai-media-suggestions", { body: { type, keywords, brand_context } })`
- React Query with `staleTime: 10 * 60 * 1000`
- Returns `{ suggestions: string[], isLoading: boolean }`

### UI changes

- Replace `const promptSuggestions = [...]` with data from the hook
- While loading: show 4 small skeleton pills (same size as suggestion buttons)
- If no SEO data or error: fall back to current hardcoded suggestions

