

# User-Based AI Persona System: Per-Department Agent Switching

## Overview
Make the AI system fully user-aware so that when specific users log in, their entire experience -- Home page, Agent Workspace, and sidebar -- adapts to show the right AI agent for their role. Three key personas to implement now:

- **sattar@rebar.shop** --> CEO Assistant (Vizzy with executive briefings, business health, cross-department oversight)
- **kourosh@rebar.shop** --> Forge (Shop Floor Manager -- cage building instructions from drawings, machinery maintenance timelines, operator management)
- **ben@rebar.shop** --> Gauge (already done in Pipeline sheet)

## What Changes

### 1. New Utility: User-to-Agent Mapping (`src/lib/userAgentMap.ts`)
A single source of truth that maps user emails to their primary AI agent persona:

```text
sattar@rebar.shop  -->  "assistant" (Vizzy as CEO Assistant)
kourosh@rebar.shop -->  "shopfloor" (Forge as Shop Supervisor)
ben@rebar.shop     -->  "estimating" (Gauge as Estimator)
```

This file exports a function `getUserPrimaryAgent(email: string)` that returns the agent config key, or `null` for default behavior.

### 2. Home Page Personalization (`src/pages/Home.tsx`)
When a mapped user lands on `/home`:
- The hero greeting changes: "How can **Forge** help you today?" instead of generic
- The primary agent's avatar appears prominently
- Quick Actions cards are filtered/reordered to match their domain
- The "Your Helpers" grid highlights their primary agent first

For **sattar@rebar.shop (CEO)**:
- Quick actions: "Business Health Score", "Today's exceptions", "Pipeline overview", "Team attendance"
- Hero: "How can your **CEO Command** help you today?"

For **kourosh@rebar.shop (Shop Supervisor)**:
- Quick actions: "What machines are running?", "Build cage from drawing", "Maintenance schedule", "Today's production queue"
- Hero: "How can **Forge** help you today?"

### 3. Forge Agent Enhancement (`src/components/agent/agentConfigs.ts`)
Update the Forge agent config to reflect shop supervisor capabilities:
- New greeting: "I'm Forge, your Shop Floor Commander. I manage machines, guide cage builds, and keep maintenance on schedule."
- Updated capabilities: "Guide cage fabrication from drawings", "Machine maintenance timeline", "Monitor machine status", "Production scheduling"
- Change `agentType` from `"support"` to a proper type

### 4. Forge System Prompt Enhancement (`supabase/functions/ai-agent/index.ts`)
Add/update the shopfloor system prompt section to include:
- **Cage building guidance**: When Kourosh asks about a drawing or cage, Forge reads the drawing context (bar sizes, shapes, dimensions) and gives step-by-step fabrication instructions (which bars to cut first, bend sequence, assembly order)
- **Machinery management**: Track machine status, flag overdue maintenance, suggest maintenance windows based on production gaps
- **Operator management**: Forge knows Kourosh is the supervisor -- it tells him which operators to assign where, flags idle machines, and alerts on blocked runs
- **Maintenance timeline**: "Machine X is due for maintenance in 3 days", "Bender BR18 has been running 14 hours -- recommend cooldown"

### 5. CEO Assistant Prompt Enhancement (`supabase/functions/ai-agent/index.ts`)
Upgrade the "assistant" agent prompt when context includes `isCEO: true`:
- Cross-department health summary on first message
- Exception-based reporting (only flag what needs attention)
- Revenue, production, AR, and team metrics at a glance
- Direct handoff suggestions: "Want me to ask Penny about that invoice?" or "Should I check with Forge on machine status?"

### 6. AgentWorkspace Auto-Routing (`src/pages/AgentWorkspace.tsx`)
When a mapped user opens any agent workspace, subtly enhance:
- If kourosh opens `/agent/shopfloor`, auto-greet with a proactive shop floor briefing (similar to Penny/Blitz pattern)
- If sattar opens `/agent/assistant`, auto-greet with CEO daily briefing

## Technical Details

### Files to Create
- `src/lib/userAgentMap.ts` -- User-email-to-agent mapping utility

### Files to Modify
1. **`src/pages/Home.tsx`** -- Import `useAuth` and `getUserPrimaryAgent`, personalize hero text, quick actions, and helper ordering based on logged-in user
2. **`src/components/agent/agentConfigs.ts`** -- Update Forge config with enhanced capabilities and proper greeting; update Vizzy config with CEO-specific capabilities
3. **`supabase/functions/ai-agent/index.ts`** -- Enhance the shopfloor/support system prompt for Forge's cage-building and maintenance logic; enhance assistant prompt for CEO mode
4. **`src/pages/AgentWorkspace.tsx`** -- Add auto-briefing logic (like Penny/Blitz) for mapped users when they open their primary agent

### No Database Changes
Uses existing `user.email` from auth context -- no new tables needed.

### Edge Function Changes
The `ai-agent` edge function will receive a `context.userRole` or `context.isCEO` flag from the frontend to activate role-specific prompt sections. The shopfloor prompt gets a major upgrade with cage-building and maintenance instruction capabilities.

