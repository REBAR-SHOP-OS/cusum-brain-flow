

# Fix: Style & Product Selections Must Be Strictly Followed in Image Generation

## Problem
When a user selects a style (e.g., Cartoon, Painting, Animation) and a product, the generated image doesn't match because:

1. **Hardcoded "MANDATORY REALISM RULE"** in the image prompt **contradicts** non-realistic styles (cartoon, animation, painting) — it says "ABSOLUTELY FORBIDDEN: CGI, 3D renders, cartoons" even when the user explicitly picked Cartoon style.
2. **Hardcoded "PHOTOREALISTIC ONLY"** at the bottom of the prompt overrides the `VISUAL STYLE` directive.
3. The same conflict exists in both `ai-agent/index.ts` and `regenerate-post/index.ts`.

## Changes

### 1. `supabase/functions/ai-agent/index.ts` (lines 799-816)
Make the realism rule **conditional** — only apply it when the user has NOT selected a non-realistic style:

- Define non-realistic styles: `cartoon`, `animation`, `painting`, `ai_modern`
- If `userImageStyles` includes any of these, **skip** the "MANDATORY REALISM RULE" and "PHOTOREALISTIC ONLY" lines
- Replace with: `"Follow the user-selected visual style EXACTLY as specified above. Do NOT default to photorealism."`
- Also fix bottom line 815: conditionally remove "PHOTOREALISTIC ONLY"

### 2. `supabase/functions/regenerate-post/index.ts` (lines 545-562)
Same conditional logic — skip realism enforcement when user selected non-realistic styles.

### Logic (both files)
```typescript
const NON_REALISTIC_STYLES = ["cartoon", "animation", "painting", "ai_modern"];
const userWantsNonRealistic = userImageStyles?.some(s => NON_REALISTIC_STYLES.includes(s));

const realismRule = userWantsNonRealistic
  ? `STYLE OVERRIDE: The user explicitly selected a non-photorealistic style. You MUST follow "${effectiveStyle}" EXACTLY. Do NOT make it photorealistic.\n\n`
  : `MANDATORY REALISM RULE: ALL images MUST be PHOTOREALISTIC — real-world photography style ONLY. ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract art.\n\n`;

const qualitySuffix = userWantsNonRealistic
  ? `- Ultra high resolution, 1:1 square aspect ratio, perfect for Instagram\n- Follow the "${effectiveStyle}" style with professional quality`
  : `- Ultra high resolution, PHOTOREALISTIC ONLY, 1:1 square aspect ratio, perfect for Instagram\n- Must look like a REAL photograph — natural imperfections, real lighting, actual textures`;
```

### Files
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

