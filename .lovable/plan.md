
# Fix: ai-estimate Edge Function WORKER_LIMIT Crash

## Problem
The `ai-estimate` edge function hits the 150MB memory limit and crashes with `WORKER_LIMIT`. The root cause is requesting up to **32,000 tokens** from Gemini 2.5 Pro, which creates a massive response object in memory, combined with 5 parallel DB queries, a large prompt (~3KB), and post-processing of all extracted items.

## Solution: Reduce Memory Footprint

### 1. Cut `max_tokens` from 32,000 to 8,000
The response rarely needs more than 8K tokens. A typical drawing yields 20-80 items at ~100 tokens each = 2K-8K tokens. This alone significantly reduces the memory consumed by the response buffer.

### 2. Limit files to first 2 (from 3)
Each file URL adds context for Gemini to process. Reducing from 3 to 2 lowers the gateway response size and processing time.

### 3. Trim the historical context
Cap the benchmarks section to 5 entries (from 10) and learnings context to a shorter summary, reducing prompt size by ~500 tokens.

### 4. Process items in smaller batches for DB insert
Instead of building a single massive array of item rows and inserting all at once, batch inserts in groups of 25 to avoid large memory allocations.

## Technical Changes

### File: `supabase/functions/ai-estimate/index.ts`

| Line | Change |
|------|--------|
| 141 | Reduce benchmarks slice from 10 to 5 |
| 154 | Change `file_urls.slice(0, 3)` to `file_urls.slice(0, 2)` |
| 245 | Change `max_tokens: 32000` to `max_tokens: 8000` |
| 344-375 | Batch item inserts in groups of 25 |

### Deployment
Redeploy the `ai-estimate` edge function after changes.

## Why This Works
Edge functions have a ~150MB memory ceiling. The 32K max_tokens response from Gemini Pro can produce a JSON string of 100KB+, which when parsed and processed (with the calculation engine running on each item) compounds memory usage. Cutting to 8K tokens and 2 files keeps the function well within limits while still extracting all items from typical drawings (most drawings yield under 80 items).
