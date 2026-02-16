
# Make Empire Builder Fully AI-Driven

## Overview

Replace the current manual Kanban/form-based Empire Builder with a **full AI chat workspace** -- just like Vizzy, Blitz, Forge, and the other agents. Instead of manually filling out forms, you talk to a new AI agent called **"Architect"** who creates ventures, updates fields, advances phases, runs stress tests, and manages everything through conversation.

## What Changes

### 1. New Agent: "Architect" (Empire AI)

Register a new agent in the existing agent system:

- **Name**: Architect
- **Role**: Venture & Product Builder
- **Agent Type**: `empire` (new type added to `AgentType`)
- **Greeting**: "I'm Architect, your AI venture builder. Tell me a problem you want to solve, an industry to attack, or a product idea -- I'll structure it, stress-test it, and build the execution plan."
- **Capabilities**: Create ventures, fill structured fields via conversation, advance phases, run AI stress tests, pull ERP/pipeline context, kill or promote ideas

### 2. Replace EmpireBuilder Page

Transform `/empire` from a static Kanban page into the **AgentWorkspace** chat interface, pre-routed to the `empire` agent. The page will:

- Reuse the existing `AgentWorkspace` component (same chat UI as all other agents)
- Route `/empire` to `/agent/empire` (or render AgentWorkspace directly with `agentId="empire"`)
- Show chat history sidebar, suggestions, and the full conversational experience

### 3. Backend: Add "empire" Agent Handler in `ai-agent` Edge Function

Add an `empire` case to the existing `ai-agent` edge function that:

- **Creates ventures** from conversation (user says "I want to build X" and the AI creates a venture record)
- **Updates venture fields** through natural language ("the target customer is small contractors in Ontario")
- **Advances phases** ("move this to Weapon Build")
- **Runs stress tests** (calls the existing `empire-architect` logic inline)
- **Lists ventures** ("show me my active ventures")
- **Pulls ERP context** (pipeline leads, orders, SEO data) to ground analysis in real data
- **System prompt** includes the full Empire Loop methodology, phase definitions, and structured output format

The AI will use tool-calling or structured JSON blocks in its responses to trigger database operations (create/update/delete ventures), similar to how other agents create notifications and tasks.

### 4. Agent Config Registration

**File: `src/components/agent/agentConfigs.ts`**
- Add `empire` config with name "Architect", image (reuse an existing helper image), and capabilities

**File: `src/lib/agent.ts`**
- Add `"empire"` to the `AgentType` union

### 5. Route Update

**File: `src/App.tsx`**
- Change `/empire` route to render `AgentWorkspace` with the empire agent (or redirect to `/agent/empire`)
- Keep the automation card on the homepage pointing to `/empire`

### 6. Venture Sidebar Context

When chatting with Architect, the AI will display venture summaries in its responses using markdown tables/cards. The existing ventures will be loaded as context in the system prompt so the AI knows what's already been created.

### 7. Keep Existing Components

The empire components (`EmpireBoard`, `VentureCard`, `VentureDetail`, `AIStressTest`, `NewVentureDialog`) stay in the codebase. They can be linked from the agent chat (e.g., "view board" opens a dialog) or used later, but the primary interface becomes conversational.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/agent.ts` | Add `"empire"` to AgentType |
| `src/components/agent/agentConfigs.ts` | Add "Architect" agent config |
| `src/pages/EmpireBuilder.tsx` | Replace with AgentWorkspace rendering for empire agent |
| `src/App.tsx` | Update `/empire` route |
| `supabase/functions/ai-agent/index.ts` | Add `empire` agent handler with venture CRUD + stress test + ERP context |

## How It Works (User Experience)

1. User opens App Builder from the homepage
2. They see a chat interface with Architect greeting them
3. They say: "I have an idea for an AI-powered rebar estimation tool for small contractors"
4. Architect responds with structured analysis, creates a venture record, and asks clarifying questions about target customer, pricing, competitive landscape
5. As the conversation progresses, Architect fills in venture fields automatically
6. User says "run a stress test" -- Architect analyzes the venture with full ERP context
7. User says "show me all my ventures" -- Architect lists them with status and phase
8. User says "advance rebar estimator to weapon build" -- Architect updates the phase and outlines MVP requirements

## No New Dependencies

Reuses all existing infrastructure: AgentWorkspace, ChatThread, ChatInput, ai-agent edge function, chat_sessions table.
