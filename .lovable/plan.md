

# Fix: "Animated Logo" Commands Trigger Regeneration Instead of Overlay

## Problems Found

1. **Intent classification is too loose** — When the user types "create animated rebar.shop logo" in the AI command bar, the words "create" and "animated" cause the AI to classify it as a generative edit, triggering full video regeneration. The overlay classification rules don't mention animated logos explicitly.

2. **ARRI Alexa example still in the prompt** (line 292) — Despite the rule on line 357 banning camera brand names, the intro scene example literally says `"shot on ARRI Alexa 35mm"`. The AI copies this example verbatim into generated prompts, causing brand names to render as garbled on-screen text.

## Changes

### 1. `supabase/functions/edit-video-prompt/index.ts`
- Expand the OVERLAY classification to explicitly include: "animated logo", "logo animation", "create logo", "logo intro", "brand intro animation"
- Add a rule: any request mentioning "logo" is ALWAYS an overlay unless the user explicitly says to change the video content
- Add an `"animated"` flag to the overlay response schema so the frontend can apply a CSS/JS animation (fade-in, scale, orbit, shimmer) to the logo overlay

### 2. `supabase/functions/ad-director-ai/index.ts` (line 292)
- Remove `"shot on ARRI Alexa 35mm"` from the intro example and replace with `"shot on 35mm anamorphic lens, f/2.8, shallow depth of field"`

### 3. `src/components/ad-director/ProVideoEditor.tsx`
- When an overlay response includes `animated: true`, apply a CSS animation class (e.g., `animate-fade-in` or a new `animate-logo-reveal`) to the overlay element instead of rendering it statically
- Add animation keyframes for logo reveal: fade-in + slight scale from 0.8 to 1.0 over 1.5s

## Files Modified
- `supabase/functions/edit-video-prompt/index.ts` — expand overlay classification for logo/animation requests
- `supabase/functions/ad-director-ai/index.ts` — fix ARRI example on line 292
- `src/components/ad-director/ProVideoEditor.tsx` — add animated overlay rendering

