

# Enhance Agent Report Dialog with Detailed English Summaries

## Problem
The current `AgentReportDialog` is minimal — it only shows domain metric numbers, session/message counts, and a user breakdown list. There is no narrative description of what the agent does, no performance assessment, and no actionable insights.

## Solution
Expand `AgentReportDialog` to include rich, detailed English content with:
1. **Agent Description** — A static paragraph explaining the agent's purpose and capabilities
2. **Performance Summary** — An auto-generated English narrative interpreting the metrics (e.g., "Blitz is managing 39 active leads with 137 hot enquiries requiring follow-up")
3. **Domain Metrics** — Keep existing grid but add context labels
4. **Activity Details** — Expanded: sessions, messages, users, last active time
5. **User Breakdown** — Keep existing but add message percentages
6. **Status Assessment** — Auto-generated health indicator (Active/Idle/Needs Attention)

## Technical Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

**1. Add `AGENT_DESCRIPTIONS` constant** (near `ALL_KNOWN_AGENTS`, ~line 1370)
A Record mapping agent codes to detailed English descriptions of each agent's function, responsibilities, and key capabilities.

**2. Rewrite `AgentReportDialog` component** (lines 1371–1469)
- Add a "Role & Responsibilities" section with the agent description text
- Add a "Performance Summary" section that generates a dynamic English paragraph based on domain stats and activity data (e.g., "Blitz currently tracks 39 active leads and 137 hot enquiries. Today, 3 users engaged in 5 sessions with 42 total messages.")
- Add a "Status" badge: green "Active" if sessions > 0, yellow "Idle" if has domain items but no sessions, gray "No Activity"
- Add "Last Active" timestamp when available
- Keep existing Domain Metrics grid, User Breakdown list
- Add "Copy Report" button that copies a plain-text English version to clipboard
- Ensure `ScrollArea` has `min-h-0` for proper scrolling
- Dialog width increased to `max-w-xl` for readability

### No new files, hooks, or database changes needed
All data is already available from `SystemAgentSummary` and `AgentDomainStat`.

