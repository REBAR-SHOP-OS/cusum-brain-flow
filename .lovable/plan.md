

# Fix: Apply Mapping Not Persisting Status

## Root Cause
The "nkjkj" session still has `status: "extracted"` in the database after Apply Mapping was clicked. Both the edge function write and the client safety net failed silently. The edge function needs redeployment (source is correct but deployed version is stale), and the client `as any` cast may be hiding RLS failures.

## Changes

### 1. Redeploy `manage-extract` edge function
No source change needed — just redeploy so the live function actually writes `status: "mapped"` (line 393 is correct in source).

### 2. Harden client safety net (`AIExtractView.tsx`, ~line 489-494)
After `applyMapping()` returns, add a **verified** DB update with error logging and a **polling retry** if status doesn't stick:

```typescript
const handleApplyMapping = async () => {
  // ... existing guards ...
  try {
    const result = await applyMapping(activeSessionId);
    
    // Force status to mapped with retry
    let retries = 0;
    while (retries < 3) {
      const { error: updateErr } = await supabase
        .from("extract_sessions")
        .update({ status: "mapped" } as any)
        .eq("id", activeSessionId);
      if (!updateErr) break;
      console.warn(`[handleApplyMapping] status update attempt ${retries + 1} failed:`, updateErr.message);
      retries++;
      await new Promise(r => setTimeout(r, 500));
    }
    
    await refreshRows();
    await refreshSessions();
    toast({ ... });
  }
};
```

### 3. Fix stale sessions in DB
Run a one-time migration to fix sessions stuck at `"extracted"` that should be `"mapped"` (rows already have status="mapped" but session never advanced). This catches the "nkjkj" session and any others.

```sql
UPDATE extract_sessions 
SET status = 'mapped' 
WHERE status = 'extracted' 
AND optimization_mode IS NOT NULL
AND id IN (
  SELECT DISTINCT session_id FROM extract_rows WHERE status = 'mapped'
);
```

## Files
- `supabase/functions/manage-extract/index.ts` — redeploy only
- `src/components/office/AIExtractView.tsx` — harden safety net (~5 lines)
- DB migration — fix stuck sessions

