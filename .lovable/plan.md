

## Fix: Preview Login Loop — Stale Token Cleanup Races with Session

### Root Cause

**Line 24-29 in `Login.tsx`** clears ALL `sb-*` localStorage keys as soon as `!user && !authLoading` is true. After OAuth redirect:

1. `onAuthStateChange` fires `INITIAL_SESSION` — if session isn't ready yet, `user=null`, `loading=false`
2. The cleanup effect runs immediately → wipes `sb-*` tokens from localStorage
3. The REAL session event arrives moments later but tokens are already gone → `bad_jwt`
4. User stays on login page

This is confirmed by auth logs showing `bad_jwt` / `missing sub claim` errors.

### Fix

**File: `src/pages/Login.tsx`**

Remove the automatic `sb-*` cleanup on mount (lines 24-30). The manual "Clear session" button at the bottom already provides this functionality for genuinely stuck users. Automatic cleanup is the cause of the problem, not the solution.

```typescript
// DELETE this entire useEffect block (lines 24-30):
// useEffect(() => {
//   if (!user && !authLoading) {
//     Object.keys(localStorage)
//       .filter((k) => k.startsWith("sb-"))
//       .forEach((k) => localStorage.removeItem(k));
//   }
// }, []);
```

That's it. One deletion. The manual "Clear session" button remains for edge cases.

### Files
- `src/pages/Login.tsx` — remove auto-cleanup useEffect

