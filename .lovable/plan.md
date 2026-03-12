

# Hard-Rule: Mandatory Brand Logo Animation on Intro & Outro Scenes

## Problem
The AI-generated scene details for intro and outro never mention brand logo overlay. When the user asks for "brand intro animation with logo," the system treats it as a generative edit and regenerates the video instead of applying a logo overlay. The logo should be a hard, automatic rule for intro/outro scenes.

## Changes

### 1. `supabase/functions/ad-director-ai/index.ts` — Update mandatory structure rules

**Intro (lines 283-292):** Change the rules to explicitly state that a brand logo overlay animation is mandatory on the intro scene. Add to the objective/scene details that "Brand logo will be rendered as an animated overlay (fade-in with scale reveal) on this scene — this is automatic and mandatory."

**Outro (lines 294-302):** Similarly reinforce that the branded end card must include the logo as an animated overlay element.

**User prompt (lines 530-533):** Add an explicit instruction: "The intro scene MUST include an animated brand logo overlay. The outro MUST include the brand logo."

### 2. `src/components/ad-director/SceneCard.tsx` — Show logo overlay status in scene details

Add a visual indicator in the scene details collapsible section for intro ("hook") and outro ("closing") scenes showing:
- A badge: "Brand Logo Overlay" with a checkmark icon
- Text: "Animated logo will be applied automatically"

This makes it visible in the UI that the logo is mandatory for these scenes.

### 3. `src/components/ad-director/StoryboardTimeline.tsx` — Auto-inject overlays for intro/outro

After storyboard generation, automatically inject logo overlays for intro and outro scenes so the user doesn't have to manually request them. When scenes are rendered:
- If segment type is "hook" (intro) → auto-add an animated logo overlay at center position
- If segment type is "closing" (outro) → auto-add a logo overlay at center position

### 4. `src/components/ad-director/ProVideoEditor.tsx` — Auto-seed overlays on mount

When the editor opens, scan the storyboard for intro/outro scenes and automatically add logo overlays to the `overlays` state if none exist yet for those scenes. This ensures the logo is always present without user action.

## Files Modified
- `supabase/functions/ad-director-ai/index.ts` — hard-rule logo in AI prompt for intro/outro
- `src/components/ad-director/SceneCard.tsx` — show logo overlay badge in scene details
- `src/components/ad-director/ProVideoEditor.tsx` — auto-inject logo overlays for intro/outro on mount

