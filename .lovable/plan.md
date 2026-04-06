

# Real-Time Monitoring for "All" View in Vizzy Brain

## Problem
The "All" view in Vizzy Brain should function as a live monitoring dashboard — always showing all sections with up-to-date data. Currently, the query has no auto-refresh interval, so data goes stale until the panel is reopened.

## Changes

### File: `src/hooks/useVizzyMemory.ts` (line ~36-48)

Add `refetchInterval` and reduce `staleTime` on the main memory query to keep data fresh:

- Add `refetchInterval: 30_000` (refresh every 30 seconds)
- Add `staleTime: 10_000` (consider data stale after 10 seconds)

This ensures the "All" view continuously pulls latest entries without manual refresh.

### File: `src/hooks/useUserAgentSessions.ts` (line ~16-18)

Reduce `staleTime` from 2 minutes to 30 seconds and add `refetchInterval: 60_000` so agent session data also stays current.

### File: `src/components/vizzy/VizzyBrainPanel.tsx` (line ~414-438)

Ensure the "All" mode (no `selectedProfile`) always shows all 16 sections — this is already the current behavior, so no change needed here. The filtering only applies when a specific user is selected.

## Result
The "All" view becomes a live monitoring dashboard that auto-refreshes every 30 seconds, keeping all sections visible and data current. Individual user views continue to show only sections with activity.

## Files Changed
- `src/hooks/useVizzyMemory.ts` — add `refetchInterval` and `staleTime`
- `src/hooks/useUserAgentSessions.ts` — reduce `staleTime`, add `refetchInterval`

