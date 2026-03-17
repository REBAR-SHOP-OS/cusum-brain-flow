
## Root-cause findings

I traced the Pixel image flow and found this is not a single bug; it is a mismatch across 3 image paths:

1. `supabase/functions/_shared/agentToolExecutor.ts`
   - The social agent tool path still tells the model to generate in a strict ratio first.
   - If non-square generation fails, it falls back to square and crops server-side, but only after the tool path is already stressed by the ratio-specific prompt.
   - When the tool ultimately fails, the assistant can reply with an apology like the screenshot.

2. `supabase/functions/ai-agent/index.ts`
   - There is a second image-generation path (`generatePixelImage`) with its own strict ratio instructions.
   - This means Pixel behavior is inconsistent depending on how the agent routes the request.

3. `supabase/functions/generate-image/index.ts`
   - The direct image dialog path also has separate ratio handling and does not share the same resilient fallback logic.

So the real fix is to unify ratio handling at the backend and make aspect ratio an output-processing concern, not something that can block generation.

## Implementation plan

### 1) Create one shared “ratio normalization + output sizing” layer
Add a shared utility for image generation that:
- accepts current ratios (`1:1`, `16:9`, `9:16`)
- also accepts future arbitrary values like `4:5`, `3:2`, `1024x1536`
- normalizes them into:
  - a safe generation strategy
  - a target output width/height
  - a crop/resize policy

This removes fragile hardcoded ratio logic scattered across multiple files.

### 2) Stop telling the AI model that ratio is a blocking constraint
Patch the social agent prompts so they no longer imply:
- “I can’t generate because of aspect ratio”
- or “the model must directly support this ratio”

Instead:
- the prompt should treat ratio as composition guidance only
- the backend should guarantee final dimensions by crop/resize after generation

This applies to:
- `supabase/functions/_shared/agents/marketing.ts`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/_shared/agentToolExecutor.ts`

### 3) Make image generation always succeed through a safe fallback chain
For all image-generation routes, use the same strategy:

```text
Requested ratio
→ try model with soft composition hint
→ if model fails / refuses / returns no image
→ retry with minimal prompt payload
→ if still needed, generate square-safe image
→ server-side crop/resize to requested dimensions
→ upload final processed asset
```

Important behavior:
- non-square requests must never fail just because the model prefers square
- final uploaded image must match requested ratio
- the user should receive a real image unless there is a true upstream outage/rate-limit

### 4) Unify the 3 backend image paths
Patch these files to use the same ratio-safe behavior:
- `supabase/functions/_shared/agentToolExecutor.ts`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/generate-image/index.ts`
- `supabase/functions/_shared/imageResize.ts`

This is the surgical fix that solves the problem “root-level” instead of patching only one screen.

### 5) Strengthen server-side crop/resize so it supports future dimensions
Upgrade `_shared/imageResize.ts` so it can:
- parse named ratios and generic ratios
- output deterministic dimensions
- preserve center composition safely
- avoid silently skipping unknown ratios

Result:
- today’s toolbar ratios work reliably
- future custom dimensions can be added without rewriting backend logic

### 6) Prevent the assistant from replying with misleading ratio excuses
If generation fails after retries:
- surface the real backend reason (`429`, `402`, timeout, upstream model failure)
- do not let the assistant invent “can’t because of aspect ratio”

This is especially important for the Pixel chat flow, since the screenshot shows the user is getting a false explanation.

### 7) Keep UI changes minimal
Frontend changes should stay small and low-risk:
- keep the current ratio selector UI
- ensure selected ratio continues to pass through `AgentWorkspace` / `ChatInput`
- no redesign needed

If useful, I would only add lightweight logging/toast improvements so failures show the actual reason.

## Files to patch

### Backend
- `supabase/functions/_shared/imageResize.ts`
- `supabase/functions/_shared/agentToolExecutor.ts`
- `supabase/functions/_shared/agents/marketing.ts`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/generate-image/index.ts`

### Frontend
- likely no structural UI rewrite needed
- possible small touch-ups in:
  - `src/pages/AgentWorkspace.tsx`
  - `src/components/chat/ChatInput.tsx`

## Expected outcome

After this patch:
- Pixel can generate images reliably for portrait, landscape, and square
- ratio selection no longer causes refusal-style replies
- final image dimensions are enforced by backend processing
- chat flow and dialog flow behave consistently
- the fix is additive and production-safe, without redesigning the app

## Known low-risk follow-up
If you want true “any custom dimensions” in the UI later, I can add a custom ratio input after this root fix. But the backend should be made ratio-agnostic first so the current problem is actually solved cleanly.
