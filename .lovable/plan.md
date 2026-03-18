

## Plan: Ensure Image Text and Caption Are Distinct

### Problem
The text overlay on generated images and the caption below are nearly identical (e.g., "Spring into Action with Ontario Steels! Your projects, reinforced. Same-day delivery in GTA." appears both on the image and as the caption). They should complement each other but be distinctly different — the image text should be a short, catchy slogan while the caption provides a different promotional angle.

### Root Cause
The prompts in three files don't explicitly instruct the AI to make the image slogan and caption **different from each other**. The AI naturally produces similar text for both.

### Changes

**1. `supabase/functions/_shared/agents/marketing.ts` (~line 86, 114-115, 134)**
- Add explicit rule: "The image text overlay (slogan) and the caption MUST be completely different. The image slogan is a short billboard-style tagline (max 6 words). The caption is a separate promotional sentence with a different angle, hook, or message. They must NOT repeat or paraphrase each other."
- In the POST-TOOL template (~line 115), add a comment reinforcing this distinction.

**2. `supabase/functions/auto-generate-post/index.ts` (~line 335-338)**
- Add to the JSON schema description: `"content"` and `"image_prompt"` slogan must be distinct messages — the caption should NOT repeat the image slogan.

**3. `supabase/functions/regenerate-post/index.ts` (~line 410-411)**
- Add explicit rule between points 1 and 2: "The caption and the image slogan MUST convey different messages. Do NOT paraphrase the slogan as the caption or vice versa."

### Files to modify
- `supabase/functions/_shared/agents/marketing.ts`
- `supabase/functions/auto-generate-post/index.ts`
- `supabase/functions/regenerate-post/index.ts`

