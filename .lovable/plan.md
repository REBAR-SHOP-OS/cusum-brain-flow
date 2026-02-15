

## AI Sales Department Manager -- "Commander" Agent

### What This Is

A new AI agent called **Commander** -- a seasoned Sales Department Manager with 22 years of experience who sits above Blitz (sales rep agent) and manages the entire sales department. Commander does not replace Blitz; Commander **manages** Blitz and the sales team (Neel/Swapnil, Saurabh), reviews their performance, identifies gaps, and escalates to ARIA (Vizzy) when cross-department coordination is needed.

### Current Sales Agent Landscape

| Component | What It Does | Gap |
|-----------|-------------|-----|
| **Blitz** (ai-agent, agent="sales") | Neel's personal accountability partner -- pipeline tracking, follow-ups, KPIs | No department-level strategy, no team management |
| **Pipeline AI** (pipeline-ai function) | One-off pipeline audits via the PipelineAISheet | Uses raw Gemini API (not Lovable AI gateway), no persistent context |
| **PipelineAISheet** (frontend) | Slide-out panel for quick pipeline reports | Only surfaces Blitz, no manager layer |
| **generate-suggestions** | Proactive ideas for dashboard | Sales suggestions are basic, no coaching |

**Core Gap**: No one is managing the sales department as a whole -- reviewing Neel and Saurabh's performance, setting weekly targets, coaching on deal strategy, or escalating resource needs to ARIA.

---

### Implementation Plan

#### 1. Register "Commander" as a New Agent Type

**File**: `supabase/functions/ai-agent/index.ts`

- Add `"commander"` to the `AgentRequest.agent` union type (line 15)
- Add `commander: "Commander"` to `agentNameMap` (line 3721)

**File**: `src/lib/agent.ts`

- Add `"commander"` to the `AgentType` union

**File**: `src/components/chat/AgentSelector.tsx`

- Add Commander to the agents array with a `Shield` or `Crown` icon and label "Commander -- Sales Manager"

#### 2. Write Commander's System Prompt

Add to `agentPrompts` in `ai-agent/index.ts`:

**Persona**: Commander -- AI Sales Department Manager with 22 years of B2B industrial sales management experience. Specializes in rebar/steel/construction sales cycles, territory management, and team coaching.

**Key responsibilities**:

| # | Responsibility | How It Works |
|---|---------------|-------------|
| 1 | **Team Performance Review** | Analyze each salesperson's pipeline velocity, conversion rate, response time, and deal aging from context data |
| 2 | **Pipeline Strategy** | Review the full pipeline and recommend stage transitions, deal prioritization, and resource allocation |
| 3 | **Coaching Neel and Saurabh** | When asked, provide specific deal-level coaching -- what to say, when to follow up, pricing strategy |
| 4 | **Weekly Sales Meeting Prep** | Generate structured agenda with KPIs, deal reviews, action items |
| 5 | **Escalation to ARIA** | When Commander identifies needs outside sales (estimating bottleneck, production delay, accounting hold), flag for ARIA routing |
| 6 | **Target Setting** | Track monthly/quarterly targets vs actuals and flag gaps early |
| 7 | **Ask Neel Questions** | When Commander needs clarification on a deal, draft specific questions for Neel to answer |
| 8 | **Competitive Intelligence** | Track win/loss patterns, common objections, and pricing trends from closed deals |

**Communication style**: Strategic, experienced, direct but mentoring. Speaks like a VP of Sales who has seen it all. Uses data to back every recommendation. Never micromanages -- focuses on outcomes.

**ARIA Escalation Protocol**: When Commander detects:
- Estimation taking too long on a hot deal --> "I recommend escalating to ARIA to check with Gauge on estimation timeline"
- Customer has unpaid invoices but wants a new quote --> "Flag for ARIA: accounts receivable issue before new quote"
- Production capacity concern affecting delivery promise --> "Route to ARIA: need Forge to confirm capacity"

Commander outputs a structured tag for ARIA escalation:
```
[COMMANDER-ESCALATE]{"to":"aria","reason":"...","urgency":"high|medium","context":"..."}[/COMMANDER-ESCALATE]
```

#### 3. Enrich Context for Commander

**File**: `supabase/functions/ai-agent/index.ts` -- in the `fetchContext` section

When `agent === "commander"`, load:

| Data | Source | Purpose |
|------|--------|---------|
| All active leads (not just top 10) | `leads` table, limit 200 | Full pipeline visibility |
| Lead activities (last 30 days) | `lead_activities` | See who is active vs dormant |
| Quotes sent/accepted/declined | `quotes` table | Conversion tracking |
| Communications log | `communications` where type = call/email, last 14 days | Response time analysis |
| Sales team profiles | `profiles` where department = sales | Team roster |
| Orders (last 90 days) | `orders` | Revenue tracking |
| Salesperson performance | Computed: leads per rep, conversion rate, avg deal size, pipeline value | KPI dashboard data |

#### 4. Morning Briefing for Commander

When Commander detects a greeting, generate a **Sales Department Briefing**:

```
**Sales Department Briefing -- [Date]**

### 1. Department KPIs
| Metric | This Week | Last Week | Trend |
| Pipeline Value | $X | $Y | up/down |
| New Leads | X | Y | |
| Quotes Sent | X | Y | |
| Deals Won | X | Y | |
| Conversion Rate | X% | Y% | |

### 2. Team Performance
| Rep | Active Leads | Stale | Quotes Pending | Revenue MTD |
| Neel | X | Y | Z | $X |
| Saurabh | X | Y | Z | $X |

### 3. Deals Needing Attention
[Top 5 deals by risk -- stale, high value, or close to deadline]

### 4. Recommended Actions
[Numbered, assigned, with deadlines]

### 5. Questions for Neel
[Specific questions about deals that need clarification]
```

Model: `gemini-2.5-pro` with `maxTokens: 6000`, `temperature: 0.3`

#### 5. Model Routing for Commander

In `selectModel`:

- Briefing / team review: `gemini-2.5-pro` (maxTokens: 5000, temp: 0.3)
- Deal coaching / strategy: `gemini-2.5-pro` (maxTokens: 3000, temp: 0.4)
- Quick questions: `gemini-2.5-flash` (maxTokens: 2000, temp: 0.5)

Commander always gets Pro-level models because department management requires nuanced multi-factor analysis.

#### 6. Tools for Commander

Commander gets the same `create_notifications` tool as other agents, plus:

- **`send_email`**: To email Neel or Saurabh with action items or questions
- **`create_notifications`**: To assign tasks to sales team members
- A new **`query_agent`** concept: Commander can reference what Blitz would say by having access to the same sales context. No actual inter-agent call needed -- Commander has the same data and more.

#### 7. Frontend Integration

**File**: `src/components/chat/AgentSelector.tsx`

Add Commander to the agent selector so it appears in the chat panel:

```
{ id: "commander", name: "Commander", icon: Crown, description: "Sales Manager" }
```

**File**: `src/lib/agent.ts`

Add `"commander"` to the `AgentType` union type.

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/ai-agent/index.ts` | 1. Add "commander" to AgentRequest type. 2. Add Commander system prompt to agentPrompts. 3. Add Commander context loading block. 4. Add Commander morning briefing. 5. Add Commander model routing. 6. Add "Commander" to agentNameMap. |
| `src/lib/agent.ts` | Add "commander" to AgentType union |
| `src/components/chat/AgentSelector.tsx` | Add Commander to agents array with Crown icon |

### No Database Changes Required

Commander uses existing tables (leads, lead_activities, quotes, communications, orders, profiles). No schema modifications needed.

