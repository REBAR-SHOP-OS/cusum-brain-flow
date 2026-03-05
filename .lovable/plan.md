

# Add Video Generation to Pixel Agent

## Problem
Pixel agent says "I can't generate videos" because it has no `generate_video` tool. The infrastructure already exists: `generate-video` edge function (Veo/Sora), `VideoGeneratorDialog` UI component, and `social-media-assets` storage.

## Changes

### 1. Add `generate_video` tool definition (`supabase/functions/_shared/agentTools.ts`)
In the `if (agent === "social")` block, add a second tool:
```typescript
{
  name: "generate_video",
  description: "Generate a short promotional video for social media using AI (Veo 3). Returns a public URL.",
  parameters: {
    prompt: { type: "string", description: "Detailed description of the video" },
    duration: { type: "number", description: "Duration in seconds (5-15)" },
    slot: { type: "string", description: "Time slot identifier" }
  }
}
```

### 2. Add `generate_video` executor (`supabase/functions/_shared/agentToolExecutor.ts`)
After the `generate_image` block, add a new `else if (name === "generate_video")` block that:
- Calls the existing `generate-video` edge function with action `"generate"`, provider `"veo"` 
- Polls until completed (with timeout)
- Uploads the resulting video to `social-media-assets` bucket
- Returns the public URL

### 3. Update Pixel prompt (`supabase/functions/_shared/agents/marketing.ts`)
- Change "image and caption generator" to "image, video, and caption generator"
- Add instructions: when user asks for a video or story, call `generate_video` instead of `generate_image`
- Add video rules (duration, style, etc.)

| File | Change |
|---|---|
| `supabase/functions/_shared/agentTools.ts` | Add `generate_video` tool for social agent |
| `supabase/functions/_shared/agentToolExecutor.ts` | Add video generation executor using existing `generate-video` function |
| `supabase/functions/_shared/agents/marketing.ts` | Update Pixel prompt to support video generation |

