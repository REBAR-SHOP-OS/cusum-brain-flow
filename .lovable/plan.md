

## Add Missing LLM Models to AVAILABLE_MODELS

### What's Missing

The `AVAILABLE_MODELS` array in `src/types/adDirector.ts` is missing two models that are available on the Lovable AI gateway:

| Model | Status |
|---|---|
| `google/gemini-2.5-flash-lite` | ✅ Already listed |
| `google/gemini-2.5-flash` | ✅ Already listed |
| `google/gemini-2.5-pro` | ✅ Already listed |
| `google/gemini-3-flash-preview` | ✅ Already listed |
| `google/gemini-3.1-pro-preview` | ✅ Already listed |
| `google/gemini-3-pro-image-preview` | ✅ Already listed |
| `google/gemini-3.1-flash-image-preview` | ✅ Already listed |
| `openai/gpt-5` | ✅ Already listed |
| `openai/gpt-5-mini` | ✅ Already listed |
| `openai/gpt-5-nano` | ✅ Already listed |
| `openai/gpt-5.2` | ✅ Already listed |
| **`google/gemini-2.5-flash-image`** | ❌ Missing — image generation model |

### Patch (1 file)

**File**: `src/types/adDirector.ts` — Add the missing model to `AVAILABLE_MODELS`:

```typescript
{ id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", category: "vision" },
```

This adds it to the AI Engine dropdown in AdvancedModelSettings automatically (no other file changes needed).

### Note on Image Generation Models

`gemini-2.5-flash-image`, `gemini-3-pro-image-preview`, and `gemini-3.1-flash-image-preview` are **image generation** models. They're listed for completeness but are primarily useful for the Ad Director's visual asset generation, not standard text LLM tasks.

### Files Changed

| File | Change | Category |
|---|---|---|
| `src/types/adDirector.ts` | Add 1 missing model entry | Safe additive |

