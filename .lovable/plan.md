
# Complete ERP Autopilot Execution System -- Remaining Gaps

## Current State

The core autopilot-engine edge function and dashboard are already built and functional. Two gaps remain that prevent full production operation.

## Gap 1: Missing config.toml Entry

The `autopilot-engine` edge function is not registered in `supabase/config.toml`. Without this, the function may fail to deploy or reject requests due to JWT verification defaults.

**File**: `supabase/config.toml`
- Add `[functions.autopilot-engine]` with `verify_jwt = false`

## Gap 2: AI Agent Cannot Invoke Execution Tools

The `ai-agent` has tools for `autopilot_create_run` and `autopilot_list_runs`, but lacks tools to:
- Execute a run (`autopilot_execute_run`)
- Simulate an action (`autopilot_simulate_action`)
- Approve/reject a run or action (`autopilot_approve_run`, `autopilot_reject_run`)

Without these, the AI cannot orchestrate autopilot flows end-to-end in conversation -- users must manually navigate to `/autopilot` for every approval and execution.

**File**: `supabase/functions/ai-agent/index.ts`
- Add 4 tool definitions that proxy to the `autopilot-engine` edge function
- Add corresponding handlers in the tool-call processing section
- The handlers will call `autopilot-engine` using the user's auth token (internal fetch)

### New Tools in ai-agent

| Tool Name | Proxies To | Purpose |
|---|---|---|
| `autopilot_execute_run` | `execute_run` | Execute an approved run (with optional `dry_run`) |
| `autopilot_simulate_action` | `simulate_action` | Preview risk and effects before committing |
| `autopilot_approve_run` | `approve_run` | Approve a run (admin only, records audit trail) |
| `autopilot_reject_run` | `reject_run` | Reject a run with optional note |

## Technical Details

### config.toml addition

```toml
[functions.autopilot-engine]
verify_jwt = false
```

### ai-agent tool definitions (added to Empire tools array)

Each tool definition follows the existing pattern (`type: "function"`, with `name`, `description`, `parameters`). The handlers will:

1. Extract the user's auth token from the existing request context
2. Make an internal `fetch()` call to the autopilot-engine function URL
3. Return the engine's response as the tool result

### Handler pattern (for each tool)

```text
if (tc.function?.name === "autopilot_execute_run") {
  const args = JSON.parse(tc.function.arguments);
  const engineRes = await fetch(autopilotEngineUrl, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ action: "execute_run", run_id: args.run_id, dry_run: args.dry_run })
  });
  const result = await engineRes.json();
  // push to tool results
}
```

## Files to Modify

| File | Change |
|---|---|
| `supabase/config.toml` | Add `autopilot-engine` entry |
| `supabase/functions/ai-agent/index.ts` | Add 4 tool definitions + 4 handlers that proxy to autopilot-engine |

## What This Does NOT Touch

- No database changes (columns and indexes already exist)
- No changes to `autopilot-engine/index.ts` (fully functional)
- No changes to `AutopilotDashboard.tsx` (already wired to the engine)
- No removal of existing functionality
