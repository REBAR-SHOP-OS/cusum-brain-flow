

## Plan: Fix Pixel Agent Image Generation Failure

### Problem
When the user asks Pixel to create an image (e.g. "یک عکس نوروز بساز"), the AI model sometimes refuses and returns a Persian error text about "aspectRatio" instead of calling the `generate_image` tool. This is a **prompt engineering issue** — the model gets confused by the many conflicting instructions about aspect ratio and produces a hallucinated error instead of taking action.

### Root Cause
The system prompt and style override inject extensive, sometimes contradictory instructions about aspect ratio:
- "do NOT pass any aspect_ratio parameter" (marketing.ts line 25)
- "SELECTED ASPECT RATIO: 1:1 — this was chosen by the user" (ai-agent line 980)
- "The image dimensions/aspect ratio are handled AUTOMATICALLY" (ai-agent line 977)

This confusion causes the LLM to think it needs to validate aspectRatio and sometimes outputs an error text instead of calling the tool.

### Solution

**File 1: `supabase/functions/_shared/agents/marketing.ts`**
- Simplify aspect ratio instructions: remove all mentions of "aspect_ratio" parameter from the prompt
- Add a single clear line: "Aspect ratio is automatic. Just call generate_image with your prompt."
- Strengthen the "NEVER refuse" rule to specifically forbid mentioning aspectRatio errors

**File 2: `supabase/functions/ai-agent/index.ts` (lines ~970-982)**
- Simplify the `socialStyleOverride` aspect ratio injection
- Remove the line "do NOT pass any aspect_ratio parameter" (contradicts itself)
- Replace with: "Image dimensions are pre-configured. Focus only on the creative prompt."

**File 3: `supabase/functions/_shared/agentTools.ts`** (no change needed — already clean)

### Key Changes Summary
1. Remove all "do NOT pass aspect_ratio" instructions that confuse the model into thinking it needs to handle aspect ratio
2. Add explicit rule: "NEVER mention aspectRatio in your response text. NEVER output errors about aspectRatio."
3. Simplify to a single instruction: "Aspect ratio is handled automatically by the system."
4. Ensure user's free-text request (topic/subject from chat message) takes priority over toolbar product selection, while aspect ratio always comes from toolbar

