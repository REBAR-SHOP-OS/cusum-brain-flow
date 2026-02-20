

# Agentic Architecture Evolution Plan

## Current State Assessment

The system already has a robust agentic architecture with 20+ specialized agents, a keyword-based router, multi-turn tool calling (5 iterations max with circuit breaker), model routing (GPT/Gemini with fallback), and domain-specific context fetching -- all in a single 9,093-line edge function (`ai-agent/index.ts`). There are also 120+ specialized edge functions for discrete tasks.

What the research document proposes largely **already exists** in the codebase. The practical gaps are:

| Proposed Feature | Current Status | Action Needed |
|---|---|---|
| Orchestrator/Router | Keyword-based router exists (`agentRouter.ts`) | Upgrade to LLM-based intent classification |
| Domain-separated memory | Per-agent context fetching exists | Add vector/embedding store for RAG |
| QA/Reviewer Agent | Not implemented | Add output validation layer |
| Prompt caching | Not implemented | Structure prompts for cache-friendly prefixes |
| Model routing | Already uses GPT/Gemini routing | Already done -- minor tuning only |
| Monolith decomposition | Single 9K-line file | Split into per-agent modules |

## Phase 1: Monolith Decomposition (Structural)

Split `ai-agent/index.ts` (9,093 lines) into modular files without changing behavior.

**What changes:**
- Extract each agent's system prompt into `supabase/functions/_shared/agents/{agentId}.ts`
- Extract context-fetching logic into `supabase/functions/_shared/agentContext.ts`
- Extract tool definitions into `supabase/functions/_shared/agentTools.ts`
- Extract tool execution handlers into `supabase/functions/_shared/agentToolExecutor.ts`
- Keep `ai-agent/index.ts` as a thin orchestrator (~500 lines) that imports modules

**File structure:**
```text
supabase/functions/
  _shared/
    aiRouter.ts              (existing -- unchanged)
    agents/
      sales.ts               (Commander prompt + tools)
      accounting.ts          (Penny prompt + tools + context)
      support.ts             (Haven prompt)
      shopfloor.ts           (Forge prompt + briefing)
      delivery.ts            (Atlas prompt + briefing)
      estimation.ts          (Gauge prompt)
      social.ts              (Pixel prompt)
      email.ts               (Relay prompt)
      data.ts                (Prism prompt)
      legal.ts               (Tally prompt)
      empire.ts              (Architect prompt + tools)
      ... (remaining agents)
    agentContext.ts           (all context-fetching functions)
    agentTools.ts             (tool definitions registry)
    agentToolExecutor.ts      (tool call handlers)
    agentBriefings.ts         (morning briefing templates)
  ai-agent/
    index.ts                  (thin orchestrator)
```

Each agent module exports: `systemPrompt`, `getTools()`, `fetchContext()`, and `briefingTemplate`.

## Phase 2: LLM-Based Intent Router

Replace the keyword-matching router with an LLM classifier for ambiguous queries.

**What changes:**
- Keep keyword matching as fast-path (confidence > threshold = instant route)
- For low-confidence matches, call a lightweight LLM (GPT-4o-mini) with a classification prompt
- Add "compound request" detection that decomposes multi-domain queries

**Implementation:**
- Update `src/lib/agentRouter.ts` to add an async `routeToAgentSmart()` function
- Create `supabase/functions/agent-router/index.ts` edge function for LLM classification
- The classifier receives the user message and returns `{ agents: string[], confidence: number }`

## Phase 3: RAG / Vector Memory

Add retrieval-augmented generation so agents can search historical data instead of loading everything into context.

**What changes:**
- Create a `document_embeddings` table with columns: `id`, `agent_domain`, `entity_type`, `entity_id`, `content_text`, `embedding` (vector), `metadata` (JSONB), `created_at`
- Create an `embed-documents` edge function that generates embeddings via the AI gateway
- Create a `search-embeddings` edge function for similarity search
- Add a nightly cron job (`embed-sync`) that indexes new/updated records (orders, leads, invoices, machine logs)
- Each agent's context fetch adds a RAG step: query top-K relevant documents before calling the LLM

**Vector search:** Use `pgvector` extension (available in Lovable Cloud) with cosine similarity.

**Token savings:** Instead of loading all invoices/orders into context (often 5,000-10,000 tokens), RAG fetches only the 5-10 most relevant records (~500-1,000 tokens). Estimated 60-80% context reduction for data-heavy agents (Penny, Forge, Blitz).

## Phase 4: QA / Reviewer Layer

Add an output validation step before returning agent responses.

**What changes:**
- Create a lightweight QA function in `_shared/agentQA.ts`
- For high-risk agents (accounting, legal, empire), run the agent's output through a validation prompt
- Checks: numerical consistency, prohibited content, hallucination detection (does the response reference data not in context?)
- For write operations (invoices, payments, DB writes), add a structured pre-flight check

**Implementation:** After the main agent responds, if the agent is in the "high-risk" list, call GPT-4o-mini with the original context + agent output and ask it to flag errors. Cost: ~200 tokens per validation (~$0.0004).

## Phase 5: Prompt Cache Optimization

Structure all prompts to maximize OpenAI/Gemini prompt caching.

**What changes:**
- Move all static content (system prompt, tool definitions, team directory, business rules) to the front of the message array
- Keep dynamic content (user context, conversation history) at the end
- Ensure system prompt + tools are identical across calls for the same agent (deterministic prefix)
- This is a refactor of message ordering in the orchestrator, not new functionality

**Expected savings:** OpenAI caches identical prompt prefixes and charges 50-90% less for cached tokens. With ~800 tokens of static prefix per agent, savings compound across calls.

## Phase 6: Executive Dashboard Agent

Enhance the existing Prism (Data) agent with cross-agent KPI aggregation.

**What changes:**
- Add a `fetchExecutiveContext()` function that pulls summary metrics from all domains
- Include: total AR, pipeline value, production throughput, open tickets, delivery success rate
- Add a "weekly digest" briefing template that Prism generates automatically
- Wire into the existing `vizzy-daily-brief` pattern

## Implementation Order and Timeline

```text
Phase 1 (Decomposition)     -- Week 1-2: Extract modules, zero behavior change
Phase 5 (Cache Optimization) -- Week 2: Reorder prompts during decomposition
Phase 2 (Smart Router)       -- Week 3: Add LLM fallback router
Phase 4 (QA Layer)            -- Week 3-4: Add validation for high-risk agents
Phase 3 (RAG/Vector)          -- Week 4-6: pgvector setup, embedding pipeline, RAG integration
Phase 6 (Executive Dashboard) -- Week 6-7: Cross-agent KPI aggregation
```

## Technical Details

### Phase 1 Module Interface

Each agent module (`_shared/agents/{id}.ts`) exports:

```typescript
export const systemPrompt: string;
export function getTools(opts: { userEmail: string; canWrite: boolean }): ToolDef[];
export async function fetchContext(supabase: any, userId: string, companyId: string): Promise<Record<string, unknown>>;
export const briefingTemplate?: (context: any) => string;
export const modelOverride?: { model: string; maxTokens: number; temperature: number };
```

### Phase 3 Database Migration

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_domain TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  content_text TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_embeddings_domain ON document_embeddings(agent_domain);
CREATE INDEX idx_embeddings_vector ON document_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Phase 2 Router Edge Function

The LLM classifier receives the user message and a list of agent descriptions, returns the best match. Uses GPT-4o-mini for speed (~200ms, ~100 tokens). Falls back to keyword matching if the LLM call fails.

### What We Are NOT Doing (and why)

- **Self-hosted open-source models**: The system already has GPT/Gemini direct API access with fallback. Self-hosting adds infrastructure complexity with marginal cost savings at current scale.
- **LangChain/LlamaIndex**: These are Python frameworks. The system is TypeScript/Deno edge functions. The existing `aiRouter.ts` already handles what these frameworks provide.
- **Separate microservices per agent**: Edge functions already provide isolation. Splitting into separate deployed functions would add latency (inter-function calls) without meaningful benefit.
- **Multi-tenant SaaS architecture**: This is premature. The system serves one company. Multi-tenancy can be added later if needed.

