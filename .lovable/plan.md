

## Replace Brain Icon with Hamburger Menu + Instructions Panel for Eisenhower Agent

### What Changes

**Problem**: The Eisenhower agent currently shows a Brain (🧠) icon that opens the full Pixel Brain dialog (with knowledge items, logo upload, etc.). The user wants a simple hamburger menu (☰) that opens an instructions-only panel where they can write custom instructions for the agent.

### Plan

**1. `src/components/agent/EisenhowerInstructionsDialog.tsx` (NEW)**
- Simple dialog/sheet with a textarea for writing custom instructions
- Save/load instructions from the `knowledge` table using `metadata: { agent: "eisenhower", type: "instructions" }`
- Same pattern as Pixel Brain's instructions save/load (lines 143-174 of PixelBrainDialog)
- No knowledge items, no logo upload — just a textarea + save button

**2. `src/pages/AgentWorkspace.tsx`**
- Import `Menu` icon from lucide-react (hamburger/three lines)
- Import the new `EisenhowerInstructionsDialog`
- Split the Brain icon button: show `Brain` for `social`, show `Menu` for `eisenhower`
- Add state `eisenhowerInstrOpen` and render the new dialog
- Keep existing `PixelBrainDialog` only for `social` agent

**3. `supabase/functions/_shared/agentContext.ts`**
- Add a block similar to the social agent's instructions fetch (lines 348-378) but for `eisenhower`
- Query `knowledge` table for items with `metadata.agent = "eisenhower"` and `metadata.type = "instructions"`
- Inject found instructions into `brainBlock` as `USER CUSTOM INSTRUCTIONS (ALWAYS FOLLOW THESE)`

### Files

| File | Action |
|---|---|
| `src/components/agent/EisenhowerInstructionsDialog.tsx` | Create — simple instructions textarea + save |
| `src/pages/AgentWorkspace.tsx` | Edit — hamburger icon for eisenhower, Brain for social |
| `supabase/functions/_shared/agentContext.ts` | Edit — load eisenhower instructions from knowledge table |
| Deploy `ai-agent` | Redeploy to pick up context changes |

