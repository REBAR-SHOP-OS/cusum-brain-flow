

## Vizzy Alerts CEO When QuickBooks Is Disconnected

### What Changes
When Vizzy loads business data and detects that QuickBooks is not connected (falling back to the mirror table), she will proactively tell the CEO about it during the conversation.

### How It Works

1. **Track QB connection status in the snapshot** -- Add a `qbConnected: boolean` field to the `VizzyBusinessSnapshot` interface in `src/hooks/useVizzyContext.ts`. Set it to `true` when the QB edge function returns data, `false` when it falls back to the mirror table.

2. **Include the warning in Vizzy's context prompt** -- Update `src/lib/vizzyContext.ts` (`buildVizzyContext`) to check `snap.financials.qbConnected`. When `false`, inject a prominent warning block like:

```
⚠️ QUICKBOOKS DISCONNECTED
Financial data is loaded from a cached mirror — it may be stale.
IMPORTANT: Tell the CEO that QuickBooks needs to be reconnected
via Settings → Integrations. Mention this early in the conversation.
```

3. **No change when QB is connected** -- When `qbConnected` is `true`, no warning appears and Vizzy behaves as normal with live data.

### Files Modified

- `src/hooks/useVizzyContext.ts` -- Add `qbConnected` to the snapshot interface and set it based on the QB fetch result.
- `src/lib/vizzyContext.ts` -- Add a conditional warning section in the context string when `qbConnected` is `false`.

### Result
Next time Vizzy starts a session and QuickBooks is disconnected, she will proactively say something like: "Hey boss, heads up — QuickBooks isn't connected right now. I'm using cached financial data, so the numbers might be a bit stale. You can reconnect it in Settings under Integrations."
