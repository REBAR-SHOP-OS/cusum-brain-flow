

## Fix: Pending Approval Filter Shows All Posts Instead of Only Pending

### Problem
The "Pending Approval" button filter (line 125-128) currently shows scheduled, published, AND pending_approval posts. It should show **only** posts that have `neel_approved === false` — the actual pending ones.

### Fix

**File**: `src/pages/SocialMediaManager.tsx` (lines 125-128)

Replace the current filter logic:

```typescript
// BEFORE
} else if (statusFilter === "pending_approval") {
  items = items.filter(
    (p) => p.status === "scheduled" || p.status === "published" || (p.status === "pending_approval")
  );
}

// AFTER
} else if (statusFilter === "pending_approval") {
  items = items.filter((p) => !p.neel_approved);
}
```

This ensures only cards **not yet approved** are visible when the Pending Approval button is active. Published posts (already approved) and approved scheduled posts will be hidden.

### Files Changed

| File | Change |
|---|---|
| `src/pages/SocialMediaManager.tsx` | Fix `pending_approval` filter to show only `neel_approved === false` posts |

