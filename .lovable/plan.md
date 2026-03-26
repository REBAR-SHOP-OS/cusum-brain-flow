

# Enforce Product & Style Selections in Video Generation Pipeline

## Problem
When a user selects a product (e.g. Fiberglass) and a style (e.g. Realism), these are weakly prepended as plain text to the prompt (`Product: fiberglass. Style: realism. <user text>`). The AI storyboard generator and cinematic prompt writer have no structured awareness of these selections, so they may ignore them.

## Solution
Pass `selectedProducts` and `selectedStyles` as structured data through the entire pipeline and inject them as mandatory directives in the AI system prompts.

### Changes

#### 1. `src/components/ad-director/AdDirectorContent.tsx`
- Pass `selectedProducts` and `selectedStyles` as separate parameters to `service.startPipeline()` instead of just prepending text

#### 2. `src/lib/backgroundAdDirectorService.ts`
- Add `selectedProducts` and `selectedStyles` parameters to `startPipeline()`
- Forward them to the `ad-director-ai` edge function in both `analyze-script` and `write-cinematic-prompt` calls

#### 3. `supabase/functions/ad-director-ai/index.ts`
- In `handleAnalyzeScript`: inject a `PRODUCT & STYLE DIRECTIVE` block into the user prompt with human-readable product descriptions and style requirements
- In `handleWriteCinematicPrompt`: inject the same product/style context so cinematic prompts reflect the selections
- Add product description mapping (fiberglass → "Fiberglass GFRP reinforcement bars — lightweight, corrosion-resistant") and style description mapping (realism → "Photorealistic, real-world professional photography look")
- Mark these as **MANDATORY** in the system prompt so the AI cannot ignore them

```text
Pipeline flow:
  ChatPromptBar → selectedProducts=["fiberglass"], selectedStyles=["realism"]
  ↓
  AdDirectorContent → passes structured data to service
  ↓
  backgroundAdDirectorService → forwards to edge function
  ↓
  ad-director-ai (analyze-script) → "MANDATORY PRODUCT FOCUS: Fiberglass GFRP bars..."
                                    "MANDATORY VISUAL STYLE: Photorealistic..."
  ↓
  ad-director-ai (write-cinematic-prompt) → same directives injected
```

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Pass products/styles as structured params to `startPipeline` |
| `backgroundAdDirectorService.ts` | Accept + forward `selectedProducts`/`selectedStyles` to edge functions |
| `ad-director-ai/index.ts` | Add product/style mappings and inject as mandatory directives in AI prompts |

