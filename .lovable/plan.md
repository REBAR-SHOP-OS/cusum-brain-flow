

# Rebar.Shop AI Video Director — Implementation Plan

## Overview

Build a new standalone page at `/ad-director` that acts as an intelligent AI creative director for producing 30-second B2B ad videos. It leverages the existing video generation infrastructure (Wan 2.6, Sora, Veo fallback chain via `generate-video` edge function), prompt transformer, brand kit, and storage — but wraps them in a script-driven, multi-scene orchestration layer with storyboard UI, continuity engine, and automatic clip stitching.

## Architecture

```text
┌─────────────────────────────────────────────────┐
│  /ad-director  (new page)                       │
│  ┌───────────┬──────────────┬──────────────────┐ │
│  │ Script    │ Storyboard   │ Preview &        │ │
│  │ Input &   │ Timeline     │ Export           │ │
│  │ Analyzer  │ (Scene Cards)│                  │ │
│  └───────────┴──────────────┴──────────────────┘ │
│           ↕ Edge Functions                       │
│  ┌──────────────────────────────────────────────┐ │
│  │ analyze-ad-script (NEW)                      │ │
│  │ generate-video (EXISTING — reuse)            │ │
│  │ transform-video-prompt (EXISTING — reuse)    │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## New Files

### 1. Edge Function: `supabase/functions/analyze-ad-script/index.ts`
- Accepts raw script text + brand profile + uploaded asset descriptions
- Uses Gemini (via `_shared/aiRouter.ts`) to:
  - Parse script into timed segments (hook, problem, solution, service, credibility, CTA)
  - For each segment, generate a storyboard scene with: objective, visual style, shot type, camera, environment, subject/action, emotional tone, transition, generation mode recommendation, continuity requirements
  - Build a ContinuityProfile that carries across scenes
  - Generate optimized video prompts per scene with continuity bridge text
- Returns structured JSON: `{ segments, storyboard, continuityProfile, scenePrompts }`

### 2. Page: `src/pages/AdDirector.tsx`
- Route: `/ad-director`
- Dark-mode creative studio layout with stepper workflow

### 3. Component: `src/components/ad-director/AdDirectorContent.tsx`
- Main orchestrator component managing workflow state (script → analyze → storyboard → generate → preview → export)

### 4. Component: `src/components/ad-director/ScriptInput.tsx`
- Script textarea with demo script pre-loaded (Rebar.Shop 30s ad)
- Brand settings panel (name, website, CTA, tagline, logo upload, brand colors)
- Asset upload zone (logos, product images, site photos, shop drawings, reference frames, voiceover, music)
- "Analyze Script" button

### 5. Component: `src/components/ad-director/StoryboardTimeline.tsx`
- Horizontal/vertical timeline of scene cards with timestamps
- Each card shows: segment label, time range, scene objective, visual style, generation mode (auto-selected with icon), editable prompt, continuity lock toggle, reference asset picker
- Per-scene controls: regenerate, rewrite prompt, lock style, replace reference image
- "Auto Storyboard" and "Generate All Scenes" buttons

### 6. Component: `src/components/ad-director/SceneCard.tsx`
- Individual scene card with: message goal, visual recommendation, selected generation method (text-to-video / image-to-video / reference continuation / static card), continuity dependency indicator, editable final prompt, generation status

### 7. Component: `src/components/ad-director/ContinuityInspector.tsx`
- Displays the ContinuityProfile: subject descriptions, environment, time of day, camera style, color mood, lighting, last-frame summary, next-scene bridge note
- Editable fields for manual overrides

### 8. Component: `src/components/ad-director/GenerationQueue.tsx`
- Shows all scene generation jobs with status (queued, generating, completed, failed)
- Per-scene regenerate button
- Progress bars per clip

### 9. Component: `src/components/ad-director/FinalPreview.tsx`
- Video player showing stitched final 30s video
- Scene-by-scene scrubber
- Toggle overlays: subtitles, logo watermark, end card
- Export MP4 button (downloads merged video)

### 10. Component: `src/components/ad-director/BrandSettings.tsx`
- Brand name, website, CTA, tagline, logo, brand color, font style, target audience
- Pre-filled with Rebar.Shop defaults
- Save as preset

### 11. Types: `src/types/adDirector.ts`
- TypeScript interfaces: `AdProject`, `BrandProfile`, `ScriptSegment`, `StoryboardScene`, `SceneAsset`, `SceneStrategy`, `ContinuityProfile`, `RenderJob`, `ClipOutput`, `FinalVideo`

## Key Implementation Details

### Script Analysis (Edge Function)
- AI parses the script identifying: hook, pain/problem, consequence, solution, proof/credibility, service coverage, urgency, CTA, closing tagline
- Each segment gets timing, and the AI recommends generation mode based on content type
- Continuity metadata is generated as a chain — each scene references the prior scene's ending state

### Scene Generation Strategy (Client-Side Logic)
For each scene, the system auto-selects:
- **Text-to-video**: Cinematic narrative scenes (hook, problem, solution)
- **Image-to-video**: When user uploaded product shots, site photos, shop drawings
- **Reference continuation**: When continuity lock is ON and prior clip exists — injects "Continue seamlessly from the previous clip..." into prompt
- **Static end card**: CTA/closing scenes where clarity > motion

### Multi-Clip Orchestration
- Uses existing `generate-video` edge function with `action: "generate"` per scene
- Client manages a generation queue, generating scenes sequentially or in parallel (2 at a time)
- Each scene's prompt includes continuity bridge from AI analysis
- Clip 2+ prompts always prepend: "Continue seamlessly from the previous clip, preserving location, subject continuity, camera language, lighting, pacing, and cinematic tone."

### Final Stitching
- Uses existing client-side canvas-based video stitching (similar to multi-scene in VideoStudioContent)
- Applies logo watermark via existing `applyLogoWatermark`
- Generates subtitles overlay via canvas text rendering synced to scene timings
- Final export as single MP4 blob

### Routing
- Add route in `App.tsx`: `/ad-director` → `AdDirector` page
- Add tile in AutomationsSection

## Existing Infrastructure Reused
- `generate-video` edge function (Wan/Sora/Veo with fallback)
- `transform-video-prompt` edge function (prompt engineering)
- `_shared/aiRouter.ts` (Gemini AI calls)
- `useBrandKit` hook
- `useVideoCredits` hook
- `applyLogoWatermark` utility
- `mergeVideoAudio` utility
- `social-media-assets` storage bucket
- `invokeEdgeFunction` utility

## Demo Experience
- Page loads with Rebar.Shop script pre-filled
- One click "Analyze" produces full storyboard
- Each scene shows the AI's reasoning for generation method
- "Generate All" kicks off the queue
- Final preview plays the merged 30s ad

