

# Strengthen Advertising-Only Tone & Ban Scientific/Technical Claims in Captions

## Problem
Captions sometimes include scientific explanations, technical claims, or guarantee-like language (e.g., "unparalleled structural integrity," "AI-driven fabrication ensures every component interlocks perfectly"). The user wants purely promotional, advertising-style captions — no scientific facts, no guarantees, no technical jargon.

## Current State
Some forbidden words are already listed (guarantee, ensures, promise, etc.) but the prompts still allow scientific/technical language. The marketing agent prompt even says "Scientific and promotional style."

## Changes

### 1. `supabase/functions/ai-agent/index.ts` — `generateDynamicContent` (~line 94-101)
Add explicit ban on scientific/technical language in the CRITICAL RULES section:
```
- CAPTION TONE: Must be PURELY PROMOTIONAL & ADVERTISING. Write like a creative ad agency — catchy, bold, emotional appeal. 
- ABSOLUTELY FORBIDDEN: scientific explanations, technical specifications, engineering terminology, material properties, structural analysis claims. Do NOT explain HOW the product works — focus on WHY the customer should buy it.
- FORBIDDEN WORDS (expanded): guarantee, guaranteed, ensures, ensure, promise, warranty, certified, certify, unparalleled, revolutionary, superior, structural integrity, load-bearing capacity, tensile strength, AI-driven, precision-engineered, interlocks
```

### 2. `supabase/functions/regenerate-post/index.ts` — caption-only prompt (~line 296-310) and full regen prompt (~line 371-385)
Same expanded forbidden list and advertising-only tone instruction.

### 3. `supabase/functions/auto-generate-post/index.ts` (~line 228-244)
Replace "Scientific and promotional style" with "Purely promotional advertising style" and add the same forbidden scientific language rules.

### 4. `supabase/functions/_shared/agents/marketing.ts` (~line 57-78)
Update the social/Pixel agent system prompt: replace "Scientific and promotional style" with pure advertising tone, expand forbidden words list.

### Files
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`
- `supabase/functions/auto-generate-post/index.ts`
- `supabase/functions/_shared/agents/marketing.ts`

