

## Plan: Strengthen Slogan vs Caption Differentiation

### Problem
The image slogan and caption text are often identical or near-identical (as shown in the screenshot: "Spring into Action! Ontario Steels: Your Partner for New Beginnings" appears both on the image and as the caption). The rules already exist in the prompts but need stronger enforcement.

### Changes

**1. `supabase/functions/auto-generate-post/index.ts`**
- In the JSON output schema description (line ~335), add explicit constraint: `"content"` field MUST NOT contain the image slogan text, and add a separate `"image_slogan"` field to the JSON schema so the AI treats them as distinct outputs
- Add post-processing validation: after parsing AI response, check if `content` starts with or contains the `image_prompt` slogan text, and if so, flag it

**2. `supabase/functions/_shared/agents/marketing.ts`**
- Add a stronger, more prominent rule block at the top of the prompt (near line 12) with a "VIOLATION EXAMPLES" section showing exactly what NOT to do
- Add explicit instruction: "The image slogan is a 6-word billboard tagline. The caption is a 2-4 sentence promotional paragraph about REBAR.SHOP services. They must have ZERO overlapping phrases."

**3. `supabase/functions/regenerate-post/index.ts`**
- Same strengthening of the slogan vs caption rule in the caption generation prompt (~line 411)
- Add post-processing: if the returned `caption` and `imageText` share >50% words, regenerate the caption portion

### Technical Details
- Add a `checkSloganCaptionOverlap(slogan, caption)` utility that computes word overlap ratio
- If overlap > 40%, rewrite the caption by calling AI again with explicit instruction: "The slogan is: X. Write a COMPLETELY DIFFERENT caption that does NOT use any words from the slogan."
- This is a backend-only change — no UI modifications needed

### Files to modify
- `supabase/functions/auto-generate-post/index.ts` — add `image_slogan` to JSON schema, add overlap check
- `supabase/functions/_shared/agents/marketing.ts` — strengthen differentiation rules
- `supabase/functions/regenerate-post/index.ts` — add overlap check post-processing

