

# Fix: Apply Mapping Not Advancing Pipeline

## Root Cause

Verified via database query: the session status is still `"mapping"` (not `"mapped"`) after Apply Mapping succeeds. The edge function source code was updated to set `"mapped"` in the previous fix, but the function may not have been redeployed. The deployed version still writes `"mapping"`.

## Fix

1. **Redeploy the edge function** (`manage-extract`) — the source already has the correct `status: "mapped"` update. Redeployment will make it take effect.

2. **Safety net in the client**: After `handleApplyMapping` succeeds, explicitly update the local session status to `"mapped"` so the UI advances immediately without waiting for a refresh. This eliminates any race condition between the edge function commit and the client fetch.

   In `src/components/office/AIExtractView.tsx`, inside `handleApplyMapping`, after the successful `applyMapping()` call and before `refreshSessions()`, optimistically update the session in local state.

Both changes are minimal — one is a redeploy, the other is ~3 lines in the existing handler.

