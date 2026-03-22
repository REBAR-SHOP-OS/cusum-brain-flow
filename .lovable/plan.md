

## Fix: Login Flow — Simplified & Robust Auth

### Problem

Users authenticate with Google successfully (auth logs confirm), but end up back on the login page. The `AuthProvider` has an over-engineered session validation flow with multiple race conditions.

### Root Cause

The `auth.tsx` has a complex flow that fights itself:

1. **`INITIAL_SESSION` is skipped** (line 56) for non-OAuth loads, forcing reliance on manual `getSession()` + `getUser()` validation
2. **The Lovable OAuth flow goes through `/~oauth`**, NOT URL hash tokens — so `isOAuthCallback` is always `false` when the user lands on `/login` after Google auth
3. This means the stale-token purge (lines 29-33) **never fires** for Lovable OAuth
4. The manual `getUser()` call (line 94) can fail with `bad_jwt` for stale tokens, triggering `signOut` that clears the newly-established session
5. `TOKEN_REFRESHED` handler can also race and clear state

### Fix — Simplify AuthProvider

Replace the current complex flow with a straightforward approach:

**File: `src/lib/auth.tsx`**

1. **Use `onAuthStateChange` as the sole session source** — stop skipping `INITIAL_SESSION`. This is Supabase's built-in mechanism and handles all cases including OAuth returns via `/~oauth`.

2. **Remove manual `getSession()` + `getUser()` validation** — this double-validation is where the race conditions live. Supabase's `onAuthStateChange` already validates and refreshes tokens internally.

3. **Keep `TOKEN_REFRESHED` guard but simplify** — only clear on confirmed token refresh failure, don't race against session establishment.

4. **Move stale-token cleanup to Login page** — clear `sb-*` keys when the Login page mounts (before any auth check). This guarantees fresh state regardless of how the user arrived.

Simplified `AuthProvider`:
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // Let all events through — INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

**File: `src/pages/Login.tsx`**

5. **Clear stale `sb-*` keys on mount** — add a one-time cleanup when Login renders, preventing stale tokens from interfering with any subsequent auth flow:
```typescript
useEffect(() => {
  // If not already authenticated, clear any stale auth tokens
  if (!user && !authLoading) {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));
  }
}, []);
```

### Why This Fixes It

- `INITIAL_SESSION` fires immediately with whatever session Supabase has — if `/~oauth` set valid tokens, the session will be valid
- No more `getUser()` call that can race and trigger signOut
- Stale tokens are cleaned up on the Login page itself, before user tries to authenticate
- The flow is simple: arrive at `/login` → clean slate → Google OAuth → `/~oauth` sets session → redirect to `/login` → `INITIAL_SESSION` fires with valid session → `user` set → `<Navigate to="/home" />`

### Files
- `src/lib/auth.tsx` — simplify to use `onAuthStateChange` only
- `src/pages/Login.tsx` — add stale token cleanup on mount

