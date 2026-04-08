

# Fix Empty Agent Activity — Add Domain-Specific Reports per Agent

## Problem

The "Agent Activity — All Users" section in Vizzy Brain only queries `chat_sessions` for the current day. Today only Pixel has sessions, so all other agents correctly show 0. But this makes the section useless — **agents should show domain-specific system metrics** relevant to their responsibility, not just chat session counts.

## Solution

Create a new hook `useAgentDomainStats` that fetches real-time domain metrics for each agent from the system database. Each agent gets a compact stats row showing its domain health alongside chat activity.

## Agent → Domain Mapping

| Agent | Domain | Metrics Source |
|-------|--------|----------------|
| **Blitz** (Sales) | Leads pipeline | `leads` — active stages (new, prospecting, qualified, hot_enquiries) |
| **Penny** (Accounting) | Invoices & AR | `accounting_mirror` — open invoices with balance > 0, `sales_invoices` — unpaid |
| **Tally** (Legal) | Contracts | `orders` — total + pending |
| **Haven** (Support) | Customer issues | `suggestions` — open suggestions count |
| **Pixel** (Social) | Social posts | `social_posts` — total, recent week count |
| **Gauge** (Estimating) | Estimates | `leads` — estimation stages (estimation_ben, estimation_karthick) |
| **Forge** (Shop Floor) | Machines & cuts | `machines` — total, `cut_plans` — active |
| **Atlas** (BizDev) | Growth pipeline | `leads` — won + qualified stages |
| **Relay** (Delivery) | Deliveries | `leads` — delivery stage, `delivery_bundles` |
| **Rex** (Data) | System health | `ai_execution_log` — recent entries |
| **Vizzy** (Commander) | Suggestions | `suggestions` — open critical/warning counts |
| **Eisenhower** | Task sessions | Chat sessions only (as-is) |

## Changes

| File | Change |
|------|--------|
| `src/hooks/useAgentDomainStats.ts` | **New file.** Single hook that runs parallel queries to fetch domain metrics for all agents. Returns a `Map<agentCode, { label: string; value: string }[]>`. Cached 60s, refetch every 60s. |
| `src/hooks/useSystemAgentSessions.ts` | No change — continues to provide chat session data. |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Modify `SystemAgentsSummary` to also call `useAgentDomainStats()`. Display domain stats as small badges below the agent name in each row. When expanded, show both user breakdown (existing) AND domain detail stats. |

## UI Design

Each agent row changes from:
```text
🤖 Blitz  👥 0  ✦ 0 sessions  ✉ 0 msgs
```
To:
```text
🤖 Blitz  👥 0  ✦ 0 sessions  ✉ 0 msgs
   📊 12 active leads · 3 hot enquiries
```

The second line shows 1-3 domain-specific stats as a compact text line in muted color below the agent name. If stats are all zero, show "No active items" instead.

## Technical Details

- The `useAgentDomainStats` hook runs **one composite query** per agent domain to minimize DB calls (batch where possible using UNION ALL or parallel Promise.all)
- Stats are computed as simple counts — no heavy aggregations
- Domain stats only show when chat sessions are zero OR always alongside sessions (always visible for context)
- `ALL_KNOWN_AGENTS` array gets a `domain` field added to map agent codes to their query functions

