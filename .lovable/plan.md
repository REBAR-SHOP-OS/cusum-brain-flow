

# Fix: "Failed to fetch" Errors During Odoo Dump Import

## Problem

170 out of 8106 files failed with "Failed to fetch" / "TypeError: Failed to fetch". The current retry logic (3 attempts, exponential backoff up to 4s) is insufficient for a 12GB ZIP with 8000+ files -- browser connections drop under sustained load.

## Changes

### 1. Increase Retry Resilience

In the `retryAsync` helper and `processQueue`:
- Increase retries from 3 to 5 (backoff: 1s, 2s, 4s, 8s, 16s)
- Add a small delay between batches (500ms) to let the browser breathe
- Reduce batch parallelism from 5 to 3 for large queues to reduce memory pressure

### 2. Add "Retry Failed" Button

After import completes with failures:
- Store the failed queue items in a ref so they can be re-attempted
- Show a "Retry 170 Failed" button next to the error count
- Clicking it re-runs `processQueue` with only the failed items (no ZIP re-parse needed)
- Button disappears when retry succeeds with 0 failures

### 3. Track Failed Items for Retry

Currently failures only store error strings. Change to also store the original queue entry (`{ pending, mapping, getBlob }`) so retry can re-use them.

## Technical Details

### File: `src/components/admin/OdooDumpImportDialog.tsx`

**retryAsync** -- increase retries to 5, increase base delay to 1500ms

**processQueue** -- add 500ms inter-batch delay, collect failed queue entries into a ref

**New state/ref:**
- `failedQueueRef = useRef<QueueItem[]>([])` -- stores failed items for retry
- After completion, if failures exist, show "Retry N Failed" button that calls `processQueue(failedQueueRef.current)`

**UI** -- Add retry button below the error list:
```text
[170 failed]
[errors list...]
[====== RETRY 170 FAILED ======]  <- green button, only shown when not uploading and failures > 0
```

### No other files modified.
