

# Rename "General Report" to "Agents" and Show Per-Employee Agent Access

## Problem
The per-employee section currently labeled "General Report" is misleading — it actually shows agent usage sessions. The user wants it:
1. Renamed from "General Report" to "Agents"
2. To clearly show which agents each employee **has access to** alongside which they **actually use**

## Changes

### `src/components/vizzy/VizzyBrainPanel.tsx`

**1. Rename section header** (line 1079):
- Change "General Report" → "Agents"

**2. Update `UserAgentsSections` component** (lines 188-319):
- Add a list of **all accessible agents** for the employee based on their role from `userAgentMap.ts` and `agentConfigs`
- Currently it shows assigned agent + used agents from sessions. Enhance to also show agents the user has access to but hasn't used yet (with "No activity yet" label — this already exists in the UI)
- The `getUserAgentMapping` already provides the primary agent. Add logic to also list all agents available to the user's role (most agents are public to all staff, Penny is restricted to admin/accounting, Pixel to admin/marketing)

**3. Keep the `UserFullReportButton`** as-is — it already generates a per-user report (clipboard copy), not the system-wide PDF

No other files need changes. No database changes.

