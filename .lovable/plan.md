

# Fix: Duplicate Eisenhower Agent in Vizzy Brain

## Root Cause

There are two different `agent_name` values in the `chat_sessions` table:
- `"Eisenhower Matrix"` (1 session) — correct, created by current code via `config.name`
- `"eisenhower"` (1 session) — legacy, created Feb 9 before the code was fixed to use `config.name` instead of `config.agentType`

The Vizzy Brain panel groups sessions by raw `agent_name`, so they appear as two separate agents.

The current code (line 315 in `AgentWorkspace.tsx`) already uses `config.name` ("Eisenhower Matrix"), so no new sessions will have this problem. This is purely a data cleanup + defensive dedup issue.

## Plan

### 1. Data migration — normalize legacy session
Rename `agent_name = 'eisenhower'` → `'Eisenhower Matrix'` in `chat_sessions`.

```sql
UPDATE chat_sessions SET agent_name = 'Eisenhower Matrix' WHERE agent_name = 'eisenhower';
```

### 2. Defensive dedup in `useUserAgentSessions.ts`
Add a normalization map so that even if future edge cases create mismatched names, the grouping merges them:

```typescript
// Before grouping, normalize agent_name
const AGENT_NAME_ALIASES: Record<string, string> = {
  "eisenhower": "Eisenhower Matrix",
};
const normalized = AGENT_NAME_ALIASES[s.agent_name] ?? s.agent_name;
```

Use `normalized` as the map key instead of raw `s.agent_name`.

### 3. Same dedup in `VizzyBrainPanel.tsx` merge logic (line 203, 218)
The `mergedAgents` logic compares `s.agentName.toLowerCase()` which already partially handles this, but after the hook fix in step 2, this becomes moot. No changes needed here if step 2 is applied.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Normalize 1 legacy row |
| `src/hooks/useUserAgentSessions.ts` | Add alias map for agent name normalization (~3 lines) |

## Impact
- The two entries merge into one "Eisenhower Matrix" entry in Vizzy Brain
- No UI, schema, or auth changes
- Defensive against future naming inconsistencies

