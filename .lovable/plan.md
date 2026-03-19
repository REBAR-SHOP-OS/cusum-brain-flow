

# Fix Vizzy Greeting + RingCentral Stale Banner

## Step 1 — Time-aware greeting

**File: `src/hooks/useVizzyVoiceEngine.ts`**

Replace line 177's hardcoded "Good morning!" with a dynamic time-of-day instruction:

- In `buildInstructions()` (line 305), compute `hour = new Date().getHours()` → morning/afternoon/evening
- Inject a line like `"Current time of day: afternoon. Greet accordingly (Good afternoon, Good evening, etc.)"` into the prompt right before the data section
- Change line 177 from `"Good morning!"` to `"a warm, personalized greeting appropriate for the time of day"` so the protocol itself is time-neutral

## Step 2 — Smarter staleness check

**File: `src/pages/Integrations.tsx`**

In `useStalenessCheck()`, after querying communications data (lines 28-42), also query `integration_connections` for each source:

```sql
SELECT last_sync_at FROM integration_connections 
WHERE user_id = ? AND integration_id IN ('gmail', 'ringcentral')
```

Then in the staleness loop (lines 53-65), add a condition: only push a stale item if **both** the last communication data AND `last_sync_at` are older than 12 hours. If `last_sync_at` is recent, the sync is healthy — skip the warning.

## Files Modified
1. `src/hooks/useVizzyVoiceEngine.ts` — time-aware greeting
2. `src/pages/Integrations.tsx` — check `last_sync_at` before showing stale banner

