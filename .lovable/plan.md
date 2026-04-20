

# REBAR_SHOP_OS_Architecture_v2.pdf — Continuation: AI Video Director Blueprint Section

## Goal
Append a comprehensive, reconstruction-grade blueprint of the **AI Video Director module** to the existing v2 architecture PDF (or generate it as a standalone companion PDF) so any engineer can rebuild the entire module from scratch using only this document.

## Scope of the new section (≈ 25-30 pages)

### 1. Executive Overview (1 page)
- Five-phase user flow: Idea → Analyze → Cinematic Prompts → Generate → Stitch+Edit
- Design philosophy: GPT=planning, Gemini=vision/eval, Wan=video synthesis
- Singleton service pattern (survives navigation)

### 2. System Architecture Diagram (2 pages)
ASCII 7-layer block diagram:
- L1 Route & Shell · L2 UI (50+ components) · L3 Singleton brain · L4 Hooks
- L5 Edge Functions (13) · L6 External providers · L7 Storage & DB

### 3. Route, Shell & Entry (1 page)
`src/pages/AdDirector.tsx` — intro gate, layout switch, error boundary, background indicator

### 4. UI Component Map (3 pages)
- 24 top-level components (table: file → role)
- 25 editor/ subfolder components (3-col grid)
- ChatPromptBar / StoryboardTimeline / SceneCard / ProVideoEditor (2,831 LOC)

### 5. Type Contract (3 pages)
Verbatim from `src/types/adDirector.ts`:
- BrandProfile, ScriptSegment, SegmentType, StoryboardScene
- ContinuityProfile, ClipOutput, PromptQualityScore (7 axes)
- DEFAULT_MODEL_ROUTES, AVAILABLE_MODELS, TASK_CATEGORY_MAP

### 6. Singleton Pipeline Service (4 pages)
`src/lib/backgroundAdDirectorService.ts` (1,194 LOC):
- Critical constants (QUALITY_THRESHOLD=7.0, EDGE_TIMEOUT_MS=180000, MAX_RETRY_ROUNDS=2)
- State shape (AdDirectorPipelineState)
- Public API (subscribe/getState/startPipeline/regenerateScene/cancel/reset)
- **22-step exact `startPipeline()` execution sequence** (the heart of the system)
- Silent-video hard rule (musicUrl: undefined per memory)

### 7. Edge Function — ad-director-ai (3 pages)
- 14 actions with model routing table (action / primary / fallback / temp / max_tokens)
- callAI() resilience (timeout, fallback, JSON repair, tool_calls extraction)
- Action contracts (request bodies + return shapes)

### 8. Edge Function — generate-video (2 pages)
- Provider configs (Wan/Veo/Sora endpoints, durations, models)
- Action endpoints (generate / generate-multi / poll / poll-multi / download)
- Capacity-error auto-rotation
- **HARD RULE: SILENT_VIDEO_MODE** + expanded WAN_BASE_NEGATIVE
- Wan i2v request body example

### 9. Supporting Edge Functions (1 page)
Table: 11 functions with LOC + role (transform-video-prompt, edit-video-prompt, generate-fix-prompt, enhance-music-prompt, analyze-ad-script, auto-video-editor, video-intelligence, gce-video-assembly, video-to-social, generate-thumbnail, elevenlabs-tts, lyria-music)

### 10. Hooks & Persistence (1 page)
- useAdDirectorBrandKit (single brand row per user)
- useAdProjectHistory (Realtime + blob: URL sanitiser)
- useVideoCredits

### 11. Database Schema (2 pages)
Verbatim DDL:
- `ad_projects` (full columns + RLS + Realtime publication)
- `brand_kit` (full columns + 3 RLS policies + updated_at trigger)
- Storage buckets: ad-assets / generated-videos (path conventions)

### 12. Browser-Side Video Pipeline (2 pages)
- `videoStitch.ts` (1,005 LOC) — preloadAndValidate, transitions, end-card, watermark, narration mix
- `rawVideoUtils.ts` — extractKeyframes, cutVideoIntoSegments (Chromium chunk-flush bug fix)
- `slideshowToVideo.ts` — Wan i2v slideshow fallback
- Helpers (videoTrim, videoWatermark, videoAudioMerge, storageUpload)

### 13. Prompt Engineering Standards (2 pages)
- Layer 1: Continuity prefix (with/without character ref)
- Layer 2: Scene prompt + post-ready cinematic tail
- Layer 3: CHARACTER LOCK header (face preservation)
- Negative prompt (always sent) + silent-mode additions

### 14. Reproduction Checklist (1 page)
Step-by-step rebuild order: types → DB migrations → storage buckets → singleton → hooks → edge functions → UI components → routing.

### 15. Known Constraints & Hard Rules (1 page)
- Silent video generation (mem://rules/silent-video-generation)
- AI routing cost strategy
- Realtime channel UUID requirement
- blob: URL sanitisation before DB persist

## Deliverable
- File: `/mnt/documents/REBAR_SHOP_OS_Architecture_v2.pdf` (replaces existing v2 with the AI Video Director chapter appended, or new file `AI_Video_Director_Blueprint.pdf` if user prefers separate)
- Generated with ReportLab Platypus (consistent typography with existing v2)
- Mandatory QA: render every page to JPEG and visually inspect for overflow/clipping/font issues before delivery

## Tech approach
Single Python script (`/tmp/build_avd_blueprint.py`) using ReportLab Platypus. Custom Frame for chapter cover. Helvetica/Helvetica-Bold/Courier fonts (no Unicode subscripts). Code blocks rendered with `<font face="Courier">` Paragraphs inside soft-grey Tables to handle long lines without clipping.

## Out of scope
- No code changes to the actual application
- No DB writes
- No edge function deployment

