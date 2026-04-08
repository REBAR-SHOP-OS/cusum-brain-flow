

# Show All Agents with Accordion in System Agent Activity Section

## Problem
The "Agent Activity — All Users" section currently shows "No agent activity today" when no sessions exist, and only lists agents that have activity. The user wants ALL agent names to always be listed, each with an expandable accordion — showing activity data if available, or "No activity today" if not.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx` — `SystemAgentsSummary` component (lines 1180-1255)

1. Define a static list of ALL known agents with their display names (from `agentTypes.ts` + `useChatSessions.ts`):
   - Blitz (sales), Penny (accounting), Tally (legal), Haven (support), Pixel (social), Eisenhower Matrix, Gauge (estimating), Forge (shopfloor), Atlas (bizdev), Relay (delivery), Rex (data), Prism (growth), Ally (talent), plus others from the agent system

2. Remove the "No agent activity today" empty state — always render the full agent list

3. Merge the static agent list with the fetched `useSystemAgentSessions()` data:
   - For agents with activity: show sessions, messages, user count, expandable user breakdown (as currently done)
   - For agents without activity: show "0 sessions, 0 msgs" in muted style, accordion still expandable but shows "No activity today"

4. Each agent row remains an `AccordionItem` with the same expand/collapse behavior

### No new files needed. No database changes.

| File | Change |
|------|--------|
| `VizzyBrainPanel.tsx` | Replace empty state with full static agent list merged with activity data |

