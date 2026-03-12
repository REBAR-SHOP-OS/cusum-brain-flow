

## Add Alibaba Cloud Wan Video Generator

### What It Does
Adds **Alibaba Wan 2.1** as a new video generation provider alongside Veo and Sora. Uses the DashScope API (async submit → poll pattern). Pricing: ~$0.07–0.13/second depending on resolution.

### API Key Required
You'll need a **DashScope API Key** from Alibaba Cloud Model Studio. No key is currently configured. I'll prompt you to add it as `DASHSCOPE_API_KEY`.

### Files to Modify

**1. `src/components/social/VideoStudioPromptBar.tsx`**
- Add Wan model to `VIDEO_MODELS`:
```typescript
{ id: "wan-2.1", label: "Alibaba Wan 2.1", provider: "wan", costLabel: "~$0.07/s", free: false }
```

**2. `supabase/functions/generate-video/index.ts`**
- Add `"wan"` to the `provider` enum in the zod schema
- Add Wan helper functions:
  - `wanGenerate()` — POST to `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis` with `X-DashScope-Async: enable` header
  - `wanPoll()` — GET `https://dashscope-intl.aliyuncs.com/api/v1/tasks/{task_id}` 
  - `wanDownloadBytes()` — fetch the video URL from completed task
- Wire into `generate`, `poll`, `download` action branches
- Add `DASHSCOPE_API_KEY` env lookup alongside existing keys
- Add Wan to the fallback chain: Veo → Sora → Wan → slideshow

**3. `src/components/social/VideoStudioContent.tsx`**
- Handle `provider: "wan"` routing when Wan model is selected

### Wan API Pattern
```text
Submit:  POST /api/v1/services/aigc/video-generation/video-synthesis
         Headers: Authorization: Bearer $KEY, X-DashScope-Async: enable
         Body: { model: "wan2.1-t2v-plus", input: { prompt }, parameters: { resolution: "720P" } }
         Response: { output: { task_id } }

Poll:    GET /api/v1/tasks/{task_id}
         Headers: Authorization: Bearer $KEY
         Response: { output: { task_status, video_url } }
```

### Setup Step
Will use `add_secret` to request your DashScope API key before implementing.

