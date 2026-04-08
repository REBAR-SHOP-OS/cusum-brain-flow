

# Add System-Wide Agents Section to Vizzy Brain "All" View

## Problem
When viewing the "All" tab in Vizzy Brain, only the Team Daily Report is shown. The user wants a section that displays all agent activity across the entire system — showing which agents were used, by whom, how many sessions/messages, grouped by agent.

## Design
Add a new `SystemAgentsSummary` component that appears below the `TeamDailyReport` in the "All" view. It will:
- Query `chat_sessions` + `chat_messages` for the selected date (defaulting to today)
- Group results by `agent_name`, showing per-agent: total sessions, total messages, which users used it, and last activity time
- Each agent row is an accordion that expands to show per-user breakdown with session counts and recent message previews
- Reuse the same date from TeamDailyReport (share the date state)

## Changes

### File: `src/hooks/useSystemAgentSessions.ts` (new)
- New hook that queries `chat_sessions` joined with `profiles` for a given date
- Groups by `agent_name` → returns array of `{ agentName, totalSessions, totalMessages, users: { name, sessions, messages }[], lastUsed }`
- Uses workspace timezone for date boundaries

### File: `src/components/vizzy/VizzyBrainPanel.tsx`
- Add `SystemAgentsSummary` component below `TeamDailyReport` in the "All" view (around line 1469-1473)
- Uses an `Accordion` with each agent as an `AccordionItem`
- Each agent header shows: agent name, total sessions, total messages, user count
- Expanded view shows per-user breakdown (name, session count, message count)
- Styled consistently with existing sections (rounded-xl border card pattern)

| File | Change |
|------|--------|
| `src/hooks/useSystemAgentSessions.ts` | New hook for system-wide agent session data |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add `SystemAgentsSummary` below TeamDailyReport in "All" view |

