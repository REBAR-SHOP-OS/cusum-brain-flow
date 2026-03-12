

# Multi-Model Intelligent Routing for AI Video Director

## Overview
Build a unified edge function that routes 13 AI task types to optimal models, with quality gates, fallback logic, and an optional advanced settings panel. Replaces the single `analyze-ad-script` function.

## Files to Create

### 1. `supabase/functions/ad-director-ai/index.ts`
Single consolidated edge function (~600 lines) handling all task types via an `action` parameter.

**Core structure:**
- `MODEL_ROUTES` config object mapping each task to `{ model, fallback, temperature, maxTokens, systemPrompt }`
- `callAI(model, messages, tools?, toolChoice?)` helper with automatic fallback on failure
- Action router: switch on `action` field dispatching to task-specific handlers
- Each handler builds appropriate system prompt + tool schema for structured output

**Model routing table:**

| Task | Primary | Fallback | Temp |
|------|---------|----------|------|
| analyze-script | google/gemini-2.5-pro | openai/gpt-5 | 0.1 |
| generate-storyboard | google/gemini-2.5-pro | openai/gpt-5 | 0.2 |
| write-cinematic-prompt | openai/gpt-5 | google/gemini-2.5-pro | 0.7 |
| score-prompt-quality | google/gemini-2.5-flash | google/gemini-2.5-flash-lite | 0.1 |
| improve-prompt | openai/gpt-5 | google/gemini-2.5-pro | 0.6 |
| analyze-reference | google/gemini-2.5-pro | openai/gpt-5 | 0.2 |
| continuity-check | google/gemini-2.5-flash | google/gemini-2.5-flash-lite | 0.1 |
| rewrite-cta | openai/gpt-5-mini | google/gemini-2.5-flash | 0.5 |
| generate-subtitles | google/gemini-2.5-flash-lite | google/gemini-2.5-flash | 0.1 |
| generate-voiceover | openai/gpt-5-mini | google/gemini-2.5-flash | 0.4 |
| classify-scene | google/gemini-2.5-flash-lite | google/gemini-2.5-flash | 0.1 |
| quality-review | google/gemini-2.5-pro | openai/gpt-5 | 0.2 |
| optimize-ad | openai/gpt-5 | google/gemini-2.5-pro | 0.5 |

- Accepts optional `modelOverrides` in request body to swap any task's model
- Returns `{ result, modelUsed, fallbackUsed, taskType, qualityScore? }`
- Handles 429/402 errors with proper messages

### 2. `src/types/adDirector.ts` — Add new types
- `AITaskType` — union of all 13 task strings
- `ModelRoute` — `{ taskType, preferredModel, fallbackModel, qualityThreshold, retryStrategy }`
- `ModelOverrides` — `Partial<Record<AITaskType, string>>`
- `PromptQualityScore` — 7 dimensions (realism, specificity, visualRichness, continuityStrength, brandRelevance, emotionalPersuasion, cinematicClarity) + overall
- `SceneIntelligence` — `{ plannedBy, promptWrittenBy, promptScoredBy, videoEngine }`
- Add `sceneIntelligence?: SceneIntelligence` and `promptQuality?: PromptQualityScore` to `StoryboardScene`

### 3. `src/components/ad-director/AdvancedModelSettings.tsx`
- Collapsible panel with "Advanced: AI Model Routing" header
- Auto/Manual toggle (default: Auto)
- In Manual mode: dropdown per task category (Script Intelligence, Prompt Generation, Evaluation, Vision, Voiceover) to select model
- Available models list from constants
- Shows current auto-selected model as default value in each dropdown

### 4. `src/components/ad-director/PromptQualityBadge.tsx`
- Small badge component: green (≥8), yellow (≥7), red (<7)
- Tooltip showing 7-dimension breakdown on hover
- "Auto-improve" button when score < 7.0

### 5. `src/components/ad-director/SceneIntelligenceBar.tsx`
- Thin bar showing model attribution: "Planned by Gemini Pro → Written by GPT-5"
- Compact text with model icons/colors

## Files to Modify

### 6. `src/components/ad-director/AdDirectorContent.tsx`
Replace single `analyze-ad-script` call with multi-step pipeline:
1. Call `ad-director-ai` with `action: "analyze-script"` → segments + raw storyboard
2. For each scene: `action: "write-cinematic-prompt"` → polished prompt (parallel, batched)
3. For each prompt: `action: "score-prompt-quality"` → quality score
4. Auto-improve any prompt scoring below 7.0 threshold
5. Update status messages to reflect pipeline stages with model names

Add state: `modelOverrides`, pass to all calls. Add `handleImprovePrompt` callback for manual re-improvement.

### 7. `src/components/ad-director/ScriptInput.tsx`
- Add `AdvancedModelSettings` as collapsible section below brand settings
- Accept `modelOverrides` + `onModelOverridesChange` props
- Update progress messages: "Gemini Pro analyzing script...", "GPT-5 writing cinematic prompts..."

### 8. `src/components/ad-director/SceneCard.tsx`
- Add `PromptQualityBadge` below the prompt section
- Add `SceneIntelligenceBar` at bottom of card
- Add "Improve Prompt" button next to Regenerate when quality < 7.0

### 9. `supabase/functions/analyze-ad-script/index.ts`
- Convert to thin proxy that forwards to `ad-director-ai` with `action: "analyze-script"` for backward compatibility

## Quality Gate Flow
The `score-prompt-quality` action returns 7 scores (0–10) + overall average. If overall < 7.0, `AdDirectorContent` automatically calls `improve-prompt` then re-scores. Max 2 improvement attempts per prompt.

## Video Engine Selection
Unchanged — handled by existing `generate-video` fallback chain (Wan → Sora/GPT → Veo). Scene intelligence metadata tracks which engine was used.

## Config
- Add `ad-director-ai` to `supabase/config.toml` with `verify_jwt = false`
- Deploy via edge function deployment

