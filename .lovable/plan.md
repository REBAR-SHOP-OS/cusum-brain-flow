

# Root Cause Analysis & Fix: Style/Product Selections Ignored

## Root Cause (Two Critical Bugs)

### Bug 1: `pixelSlot` from client is never used
In `ai-agent/index.ts` line 597:
```typescript
const timeSlotNum: number | undefined = undefined; // time-based input removed
```
The `pixelSlot` variable is extracted from the request body (line 421) but **never connected** to `timeSlotNum`. So when the client sends a slot number via `handleApprovePixelSlot`, the deterministic path (which correctly applies overrides) is **never triggered**. The request falls through to the LLM free-text path instead.

### Bug 2: LLM-generated prompt contains conflicting product names
When the LLM path handles the request, it calls `generate_image` with a prompt like *"Create a 3D animated render of a Rebar Cage..."*. The tool executor prepends a mandatory block saying "PRIMARY SUBJECT: Stirrups", but the rest of the prompt still says "Cage" everywhere. The image model follows the majority of the prompt and generates a cage.

## Changes

### 1. `supabase/functions/ai-agent/index.ts` — Connect pixelSlot to deterministic path
- Replace `const timeSlotNum: number | undefined = undefined;` with `const timeSlotNum = pixelSlot as number | undefined;`
- This ensures that when the client sends a slot number, the deterministic image generation path (which has robust style/product overrides) is used

### 2. `supabase/functions/_shared/agentToolExecutor.ts` — Strip conflicting product names from LLM prompt
- After building the mandatory block, scan the LLM-generated `imagePrompt` and **replace** mentions of non-selected products with the selected product
- Product names to scan/replace: "Rebar Cage", "Rebar Stirrup", "Fiberglass", "Wire Mesh", "Dowel", "Hook", "Straight Rebar"
- This ensures the entire prompt is consistent with the user's selection, not just the header

### 3. `supabase/functions/ai-agent/index.ts` — Strengthen free-text system message
- In the `socialStyleOverride` block (line 946-953), add explicit instruction: "When calling generate_image, the prompt text itself MUST describe the selected product. Do NOT describe a different product in the prompt text."

## Files
- `supabase/functions/ai-agent/index.ts` — connect pixelSlot + strengthen system message
- `supabase/functions/_shared/agentToolExecutor.ts` — strip conflicting product names from prompt

