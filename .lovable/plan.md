

# Add "All Agents Report" Dialog to Per-User Agents Section

## What happens now
The clipboard icon next to "Agents" in the per-user view opens a general user performance report (`UserFullReportButton`). It does not show a dedicated agents report.

## What will change
Clicking the clipboard icon next to "Agents" will open a new dialog with a comprehensive English text report covering **all agents** assigned to that user — their activity, sessions, messages, and recent conversation excerpts.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

1. **Create `UserAgentsFullReportButton` component** — a new button+dialog that:
   - Iterates over all agents assigned to the user (from `mergedAgents` data already available via `useUserAgentSessions`)
   - Generates a structured English report with sections per agent: name, role, session count, message count, last active time, and recent message excerpts
   - Displays the report in a scrollable dialog with a "Copy to Clipboard" button
   - Format: plain English text, structured with headers per agent

2. **Replace** the `UserFullReportButton` on line 1958 (inside the Agents section header) with the new `UserAgentsFullReportButton`, passing the user's ID, name, email, override agents, and selected date.

3. The existing `UserFullReportButton` stays available in the General Overview section — it is not removed, just no longer duplicated in the Agents header.

### Report format example
```text
🤖 Agent Activity Report — Zahra
📅 Date: Apr 9, 2026

── Pixel (Social Media) ──
  Status: Primary Agent
  Sessions: 3 | Messages: 24 | Last Active: Apr 9, 2:30 PM
  Recent:
    • [User] Schedule a post for tomorrow
    • [Pixel] Done. Post scheduled for Apr 10 at 9:00 AM.

── Eisenhower Matrix ──
  Status: Access
  Sessions: 0 | No activity today

── Blitz (Sales & Pipeline) ──
  Status: Access
  Sessions: 1 | Messages: 8 | Last Active: Apr 9, 11:15 AM
```

### No database changes needed
All data is already fetched by `useUserAgentSessions` hook.

