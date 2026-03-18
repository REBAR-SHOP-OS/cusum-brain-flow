

## Fix: Pixel Agent Must Generate Image Silently — No Extra Text

### Problem (from screenshot)
When user says "یک عکس برای نوروز بساز", the agent responds with a long Persian description ("تصویر: یک سایت ساخت و ساز پر جنب و جوش...") instead of actually generating the image and showing it with a caption. The user then says "عکس را بساز" and still no image appears.

### Root Cause
Two issues:
1. **Follow-up call verbosity**: After `generate_image` tool executes, the follow-up AI call (line 1094) generates verbose Persian text describing what was created. The prompt says "no extra text" but the model still narrates.
2. **Persian output in response**: The agent is writing its creative direction in Persian instead of just outputting the image + English caption + `---PERSIAN---` block.

### Fix

**File: `supabase/functions/_shared/agents/marketing.ts`**

Strengthen the prompt with explicit post-tool-call instructions:
- Add: "After `generate_image` returns a URL, your ENTIRE response must be ONLY: `![Product](URL)` + English caption + contact + hashtags + `---PERSIAN---` translation. NOTHING ELSE. No Persian descriptions of the image concept. No creative direction. No narration."
- Add: "NEVER write in Persian outside the `---PERSIAN---` block. All text before `---PERSIAN---` must be English."
- Add: "When `generate_image` tool result contains `image_url`, you MUST embed it immediately as `![...](url)`. Do NOT describe the image in text."

**File: `supabase/functions/ai-agent/index.ts`**

Add a post-processing step for social agent responses (after line 1107):
- If agent is `social` and reply contains verbose Persian text before any image markdown, strip the pre-image text
- Specifically: if reply doesn't start with `![` and contains `![`, trim everything before the first `![`
- This is a safety net — the prompt fix is the primary solution

### Files to Change
- `supabase/functions/_shared/agents/marketing.ts` — tighten post-tool-call output rules
- `supabase/functions/ai-agent/index.ts` — add post-processing safety net for social agent

