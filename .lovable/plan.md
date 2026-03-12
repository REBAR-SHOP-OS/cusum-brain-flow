

# Enhance Storyboard AI: Intelligent Intro, Outro & Transitions

## Problem
The current `ANALYZE_SCRIPT_PROMPT` gives the AI general storyboard instructions but lacks explicit creative direction for crafting cinematic intros, branded outros, smooth transitions, and professional ad structure. The result is functional but not polished — no dedicated opening hook scene, no branded end card, and transitions are noted but not enforced.

## Changes

### `supabase/functions/ad-director-ai/index.ts` — Enhance the ANALYZE_SCRIPT_PROMPT

Expand the system prompt with explicit creative direction rules:

1. **Mandatory Intro Scene**: Always generate an opening scene (0-2s) with a dramatic establishing shot — aerial/drone, slow reveal, or cinematic fade-in that sets the mood before the script begins.

2. **Mandatory Branded Outro**: Always generate a closing scene (last 3-4s) as a `static-card` or `motion-graphics` end card with brand logo, tagline, CTA, and website. Use brand colors as background gradient.

3. **Transition Rules**: Enforce specific transition types between scene categories:
   - Hook → Problem: hard cut or whip pan for urgency
   - Problem → Solution: dramatic reveal (dolly push, crane up, or light shift)
   - Solution → CTA: smooth dissolve or zoom into brand element
   - Between similar scenes: match-cut on geometry/movement

4. **Pacing & Rhythm**: Add pacing instructions — fast cuts (2-3s) for problem/urgency scenes, slower holds (4-5s) for solution/credibility scenes.

5. **Scene Count Optimization**: Ensure the AI generates 6-8 scenes for a 30s ad (not too few, not too many), with proper time allocation.

### Update the user prompt in `handleAnalyzeScript`

Add brand colors and aesthetic reference to the prompt so the AI can incorporate them into intro/outro visual design.

## Files Modified
- `supabase/functions/ad-director-ai/index.ts` — enhanced ANALYZE_SCRIPT_PROMPT and handleAnalyzeScript user prompt

