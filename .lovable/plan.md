
Issue identified:
There are still multiple backend image-generation paths, and the previous fix only covered one of them. The unsupported top-level `aspect_ratio` field is still present in direct gateway calls inside:
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

Why the problem keeps coming back:
- The project has duplicated image generation logic in at least 3 places.
- One shared path was cleaned earlier, but the older direct paths still send `aspect_ratio` to the AI gateway.
- That means some chats/regenerations hit the fixed path, while others still hit a broken path, so the error appears “again”.

Do I know what the issue is?
Yes.

Exact root cause:
- In `ai-agent/index.ts`, the direct image request still sends:
  `aspect_ratio: aspectRatio`
- In `regenerate-post/index.ts`, the regenerate flow still sends:
  `aspect_ratio: aspectRatio`
- The gateway image request should rely on prompt instructions plus server-side crop/resize, not a top-level `aspect_ratio` parameter.

Permanent fix plan:
1. Remove the unsupported `aspect_ratio` field from every direct AI gateway image request in:
   - `supabase/functions/ai-agent/index.ts`
   - `supabase/functions/regenerate-post/index.ts`

2. Keep aspect ratio handling only through the safe mechanisms already in the code:
   - prompt-level orientation instructions
   - `cropToAspectRatio(...)` after generation

3. Make the fix durable by reducing duplication:
   - either route these paths through the shared executor/helper
   - or extract a small shared image-request builder so no file can accidentally reintroduce `aspect_ratio`

4. Add defensive logging around image generation path selection:
   - log which path is used (`ai-agent`, shared tool executor, or regenerate-post)
   - log resolved ratio and whether fallback crop was applied
   This makes future regressions easy to identify.

5. Verify all image-related flows after the change:
   - new Pixel chat image generation
   - short “بساز” command flow
   - regenerate image/post flow
   - 9:16, 16:9, and 1:1 cases

Files to update:
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`
- optionally a shared helper under `supabase/functions/_shared/` to prevent this class of bug from returning

Expected result:
- Pixel will stop surfacing aspect-ratio errors to users
- all generation paths will behave consistently
- non-square sizes will still work because ratio enforcement remains in prompt guidance + server-side crop, which is the correct supported approach
