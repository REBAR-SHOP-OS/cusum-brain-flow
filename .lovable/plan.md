

# Remove AgentSuggestionsPanel from Accounting Workspace

## What Changes

Remove the `<AgentSuggestionsPanel>` component from `AccountingWorkspace.tsx` (line 193) and its import (line 26). Penny's suggestions are already included in the daily briefing and chat context -- showing them separately in the workspace is redundant and clutters the UI.

## Technical Details

### File Modified (1)

| File | Changes |
|------|---------|
| `src/pages/AccountingWorkspace.tsx` | Remove import of `AgentSuggestionsPanel` (line 26) and remove `<AgentSuggestionsPanel agentCode="penny" agentName="Penny" />` (line 193) |

No other files affected. The `AgentSuggestionsPanel` component itself remains available for use in other workspaces.

