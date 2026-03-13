

# Improve Image Text/Slogan Quality — Simple, Correct, Ad-Only

## Problem
The text rendered inside AI-generated images (the `imageText` field / slogan) sometimes contains technical claims, guarantee-like language, or overly complex wording. The user wants it to be: simple, beautiful advertising text, grammatically correct, and absolutely free of guarantees or scientific claims.

## Changes

### 1. `supabase/functions/ai-agent/index.ts` (~line 89, 101)
Strengthen the imageText/slogan instruction:
```
2. Write a SHORT English advertising slogan (MAXIMUM 6 words) that will be printed ON the image. 
   It MUST be: simple, catchy, beautiful, and grammatically correct. 
   It should be a pure advertising tagline — NO guarantees, NO technical terms, NO scientific claims. 
   Think of it like a billboard slogan: short, emotional, memorable.
   Examples of GOOD slogans: "Steel That Builds Dreams", "Your Project, Our Pride", "Strength Meets Style"
   Examples of BAD slogans: "Unparalleled Structural Integrity", "AI-Driven Precision Engineering", "Guaranteed Quality Framework"
```

Update rule at line 101:
```
- IMAGE SLOGAN RULES: Must be a simple, beautiful advertising phrase. Maximum 6 words. No technical jargon. No guarantees. No scientific claims. Must be grammatically perfect English. Think billboard advertising.
```

### 2. `supabase/functions/regenerate-post/index.ts` (~line 376, 390)
Same strengthened slogan instruction and rules for full regeneration prompt.

### 3. `supabase/functions/auto-generate-post/index.ts` (~line 256-260)
Update `image_prompt` instruction to enforce same simple advertising text rules for the text overlay.

### Files
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`
- `supabase/functions/auto-generate-post/index.ts`

