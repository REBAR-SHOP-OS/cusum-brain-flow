

# Fix "Machine Busy" Error on Lock & Start

## Problem
When clicking "LOCK & START", the client-side code blocks with "Machine busy" toast even though the server-side `manage-machine` edge function has its own auto-recovery logic that would handle it. The issue is a mismatch between client and server stale detection:

- **Client** (CutterStationView line 345): Only auto-clears runs older than **60 minutes** with 0 output
- **Server** (manage-machine line 165): Auto-recovers runs older than **30 minutes**, plus orphans


<lov-tool-use id="thinking-568936f0-8e81-42af-b8fb-7e499d848bfe" name="lov-think" data="Let me continue the plan from where it was cut off." duration="0.432333">
</lov-tool-use>
<lov-plan>

# Fix "Machine Busy" Error on Lock & Start

## Problem
When clicking "LOCK & START", the client-side code blocks with a "Machine busy" toast even though the server already has robust auto-recovery logic. Two issues cause this:

1. **Client blocks before server can help**: The client checks `machine.current_run_id && machine.status === "running"` and only auto-clears runs older than **60 minutes** with 0 output. If the run is between 5 min and 60 min old (or has any output), the client immediately shows "Machine busy" and **never calls the server**.

2. **Server is smarter**: The `manage-machine` edge function auto-recovers stale runs (>30 min), orphans, inactive runs, and completed-job runs. But the client gate prevents the request from ever reaching the server.

## Solution
Remove the client-side blocking logic and let the server handle recovery. The server already has all the intelligence needed (stale detection, orphan detection, active-job-done detection, double-tap idempotency). The client should just call `start-run` and handle the server's error response gracefully.

### Changes to `src/components/shopfloor/CutterStationView.tsx`

**Replace** the entire client-side stale-check block (lines 336–366) with a simple pass-through that keeps only the `completedLocally` pre-cleanup:

```typescript
// If we just completed/aborted locally, do pre-cleanup
if (completedLocally && machine.current_run_id) {
  try {
    await manageMachine({ ... complete-run cleanup ... });
    await new Promise(r => setTimeout(r, 800));
  } catch (e) { /* already handled */ }
}

// Let the server handle all recovery — don't block client-side
```

Remove the block that checks `!completedLocally && machine.current_run_id && machine.status === "running"` and shows the "Machine busy" toast. Instead, let the `manageMachine({ action: "start-run" })` call go through — the server will either:
- Auto-recover the stale/orphan/inactive run and start the new one
- Return a proper error if the run is genuinely active (which we then show as a toast)

### Specific edit (lines 336–367):

**Before**: Client checks run age > 60 min, blocks otherwise with "Machine busy"

**After**: Skip the client-side gate entirely. The `try/catch` around the `manageMachine` call at line 404 already handles server errors with a toast.

This means:
- Runs aged 5s–30min: Server returns "Machine already has an active run" → toast shown
- Runs aged 30min+: Server auto-recovers → new run starts successfully
- Orphan/inactive runs: Server auto-recovers → new run starts
- Completed job runs: Server auto-recovers → new run starts

No backend changes needed — the server logic is already correct.

