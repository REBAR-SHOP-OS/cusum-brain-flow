

# Add Logo Watermark Overlay to Scene Previews & Improve Intro/Outro Logo Handling

## Problem
1. **Scene previews show no logo** — Individual scene thumbnails/videos in SceneCard display the raw AI-generated video without any logo watermark. The logo is only applied during the final export stitch.
2. **Intro and outro scenes don't show the actual logo** — The AI prompt tells the video model to "include the brand logo" but text-to-video models can't render a real uploaded logo. The result is garbled text approximations (as seen in the screenshots).

## Solution

### 1. Add CSS logo overlay on scene preview videos (`SceneCard.tsx`)
Overlay the brand logo on top of each scene's video preview using absolute positioning, matching the watermark position used in the stitch pipeline (bottom-right, 70% opacity). This gives users visual confirmation that the logo will appear on every scene.

### 2. Add CSS logo overlay on ProVideoEditor player (`ProVideoEditor.tsx`)
Same overlay on the main video player in the editor so users always see their logo positioned on the video.

### 3. Fix AI prompts to stop asking video models to render logos (`ad-director-ai/index.ts`)
Update the `ANALYZE_SCRIPT_PROMPT`:
- **Intro scene**: Remove any mention of rendering the logo in the video. The intro is a pure cinematic establishing shot — the logo watermark is handled by the overlay system.
- **Outro/End Card**: Change `generationMode` guidance to explicitly state that the end card is rendered by the stitching engine (Canvas), not by the video model. The AI should NOT generate a video for the end card — it should produce metadata (brand name, tagline, CTA, colors) that the existing `drawEndCard` function uses.

### 4. Skip video generation for end card scenes (`AdDirectorContent.tsx`)
When `generateScene` is called for a scene with `generationMode: "static-card"` or segment type `"closing"`, skip the video generation API call entirely. Instead, generate a canvas-rendered end card preview image using the brand data, and set it as the clip's thumbnail directly.

## Files Modified
- `src/components/ad-director/SceneCard.tsx` — add logo overlay on video preview
- `src/components/ad-director/ProVideoEditor.tsx` — add logo overlay on main player
- `supabase/functions/ad-director-ai/index.ts` — fix prompts to not ask video models to render logos
- `src/components/ad-director/AdDirectorContent.tsx` — skip video gen for end card scenes, render canvas preview instead

