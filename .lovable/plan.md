

## Fix: Prevent Duplicate AI Scans on Accounting Page

### Problem
The "Scan Now" button in the AI Actions Queue can be clicked multiple times while a scan is already in progress. The button's `disabled` prop checks `loading`, but the `triggerAutoActions` function never sets `loading` to `true`, so the guard has no effect.

### Root Cause
In `src/hooks/usePennyQueue.ts`, the `triggerAutoActions` function (line 144-152) invokes the edge function but does not toggle any loading state. The `loading` state is only managed by the `load` function (which fetches queue items), not by the scan trigger.

### Solution
Add a dedicated `scanning` state to `usePennyQueue` that is set to `true` before invoking the edge function and `false` after completion. Expose it from the hook and use it to disable the "Scan Now" button.

### Changes

**File: `src/hooks/usePennyQueue.ts`**
- Add `const [scanning, setScanning] = useState(false);` state
- Wrap `triggerAutoActions` with `setScanning(true)` before the invoke and `setScanning(false)` in a `finally` block
- Add early return if `scanning` is already `true` (prevents race conditions)
- Export `scanning` from the hook return

**File: `src/components/accounting/AccountingActionQueue.tsx`**
- Destructure `scanning` from `usePennyQueue()`
- Change the "Scan Now" button: `disabled={scanning}` (instead of `loading`)
- Change the spinner/icon: show `Loader2` when `scanning` is true (instead of `loading`)

### Technical Detail

In `usePennyQueue.ts`:
```typescript
const [scanning, setScanning] = useState(false);

const triggerAutoActions = useCallback(async () => {
  if (scanning) return; // guard against concurrent scans
  setScanning(true);
  try {
    const { data, error } = await supabase.functions.invoke("penny-auto-actions");
    if (error) throw error;
    toast({ title: "Penny scanned invoices", description: `${data?.queued || 0} new actions queued` });
  } catch (err) {
    toast({ title: "Auto-scan failed", description: String(err), variant: "destructive" });
  } finally {
    setScanning(false);
  }
}, [scanning, toast]);
```

In `AccountingActionQueue.tsx`:
```typescript
const { ..., scanning, triggerAutoActions } = usePennyQueue();

<Button ... onClick={triggerAutoActions} disabled={scanning}>
  {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
  {scanning ? "Scanning..." : "Scan Now"}
</Button>
```

