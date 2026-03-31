

# Fix: Extraction Succeeds But UI Shows "No Rows Found"

## Root Cause

When `runExtract()` throws (due to HTTP timeout: `connection closed before message completed`), the **catch block overwrites the session status to "error"** (line 493-498). However, the edge function continues processing in the background and successfully inserts all 160 rows, then sets the session back to "extracted".

The problem: `useExtractRows` only fetches rows when `sessionId` changes. After the HTTP error, `sessionId` stays the same, so no re-fetch happens. The realtime subscription for rows may miss inserts that occurred during the timeout window. The 2-second retry also fails because rows aren't inserted yet at that point.

**Result**: Session shows "extracted" (step 3), but `rows` array is empty → "No extracted rows found."

## Fix (2 changes in 1 file)

### File: `src/components/office/AIExtractView.tsx`

**Fix 1 — Don't overwrite status to "error" if extraction already succeeded**

In the catch block (line 492-500), before setting status to "error", check if the session has already transitioned to "extracted" in the background:

```typescript
} catch (err: any) {
  // Only revert to error if the edge function hasn't already succeeded
  if (activeSessionId) {
    const { data: currentSession } = await supabase
      .from("extract_sessions")
      .select("status")
      .eq("id", activeSessionId)
      .maybeSingle();
    
    if (!currentSession || (currentSession as any).status !== "extracted") {
      await supabase
        .from("extract_sessions")
        .update({ status: "error", error_message: err.message || "Extraction failed" } as any)
        .eq("id", activeSessionId);
    }
    await refreshSessions();
    await refreshRows();  // ← Force row refresh in case rows were inserted
  }
  toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
}
```

**Fix 2 — Re-fetch rows when session status transitions to "extracted"**

Add an effect that watches `activeSession?.status` and triggers a row refresh when it becomes "extracted":

```typescript
// After the existing useEffect for unit sync (around line 258)
useEffect(() => {
  if (activeSession?.status === "extracted" && rows.length === 0 && !rowsLoading) {
    refreshRows();
  }
}, [activeSession?.status]);
```

This ensures that if realtime updates the session to "extracted" after an HTTP timeout, the rows are re-fetched.

### Same fix for retry blocks (lines 1547-1554 and ~1647)

Apply the same "check before overwriting status" pattern to the retry catch blocks.

## Impact
- 1 file changed (`AIExtractView.tsx`)
- No database, edge function, or schema changes
- Prevents the race condition where a successful extraction is incorrectly marked as "error"
- Adds automatic row recovery when session reaches "extracted" state

