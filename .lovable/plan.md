

# Fix: User-selected style + product must control image generation

## Problem
The backend already receives `imageStyles` and `selectedProducts` from the UI, but:
1. In `ai-agent/index.ts` line 772, the `VISUAL STYLE:` directive still uses a **random pool style** even when the user explicitly selected a style (e.g., "realism"). The user's style choice should **override** the random pool.
2. In `regenerate-post/index.ts`, there is **no support** for `selectedProducts` or `imageStyles` — regenerated posts ignore user preferences entirely.

## Changes

### 1. `supabase/functions/ai-agent/index.ts` (~line 720-773)
- When `userImageStyles` is non-empty, **override** `selectedStyle` with the user-selected style descriptions instead of using the random pool
- Change `VISUAL STYLE:` line to use user style when available:
  ```
  const effectiveStyle = userImageStyles?.length 
    ? userImageStyles.map(k => IMAGE_STYLE_MAP[k] || k).join(". ")
    : selectedStyle;
  ```
- Remove the separate `userStyleBlock` prepend since it's now merged into `VISUAL STYLE:`

### 2. `supabase/functions/regenerate-post/index.ts`
- Accept `selectedProducts` and `imageStyles` from the request body
- Add `IMAGE_STYLE_MAP` and `PRODUCT_PROMPT_MAP` (same as ai-agent)
- Inject user style and product overrides into the regeneration prompt

### Files
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

